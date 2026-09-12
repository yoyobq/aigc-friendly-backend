const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');

const dotenv = require('dotenv');
const Redis = require('ioredis');

const STARTUP_TIMEOUT_MS = 90_000;
const SHUTDOWN_TIMEOUT_MS = 15_000;
const POLL_INTERVAL_MS = 250;
const MAX_DIAGNOSTIC_LINES = 80;

const developmentEnvPath = path.join(process.cwd(), 'env', '.env.development');
dotenv.config({ path: developmentEnvPath, quiet: true });

let childProcess = null;
let requestedSignal = null;

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    requestedSignal = signal;
    signalChildProcess(signal);
  });
}

async function main() {
  const redis = createRedisClient();
  const diagnostics = createDiagnostics();
  let childExitPromise = null;
  let redisConnected = false;
  const smokeBullMqPrefix = `dev-smoke-${process.pid}-${Date.now()}`;

  try {
    await redis.connect();
    redisConnected = true;
    const port = await reservePort();
    const host = '127.0.0.1';

    process.stdout.write(`Starting dev runtime smoke on http://${host}:${port}\n`);
    childProcess = spawn(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['run', 'dev'],
      {
        cwd: process.cwd(),
        detached: process.platform !== 'win32',
        env: {
          ...process.env,
          APP_HOST: host,
          LOG_LEVEL: 'info',
          APP_PORT: String(port),
          AI_WORKFLOW_HOUSEKEEPING_ENABLED: 'false',
          BULLMQ_PREFIX: smokeBullMqPrefix,
          CAPABILITY_DISABLED_IDS: resolveSmokeDisabledCapabilities(),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    childExitPromise = observeChildExit(childProcess);
    diagnostics.observe(childProcess.stdout);
    diagnostics.observe(childProcess.stderr);

    const startupDeadline = Date.now() + STARTUP_TIMEOUT_MS;
    const readinessPromise = waitUntil({
      deadline: startupDeadline,
      description: 'API readiness',
      check: async () => await isApiReady({ host, port }),
    });
    const workerReadyPromise = waitUntil({
      deadline: startupDeadline,
      description: 'Worker bootstrap completion',
      check: () => diagnostics.hasWorkerReadyOutput(),
    });

    await Promise.race([
      Promise.all([readinessPromise, workerReadyPromise]),
      childExitPromise.then((exit) => {
        throw new Error(`npm run dev exited before readiness (${formatExit(exit)})`);
      }),
    ]);

    if (!diagnostics.hasApiOutput() || !diagnostics.hasWorkerOutput()) {
      throw new Error('combined dev output did not contain both [api] and [worker] prefixes');
    }

    process.stdout.write(`✓ API ready: http://${host}:${port}/health/readiness\n`);
    process.stdout.write('✓ Worker bootstrap and runtime assembly completed\n');
    process.stdout.write('✓ Combined [api] and [worker] output observed\n');
  } catch (error) {
    process.stderr.write(`Dev runtime smoke failed: ${formatError(error)}\n`);
    diagnostics.print();
    process.exitCode = 1;
  } finally {
    if (childProcess && childExitPromise) {
      await stopChildProcess(childExitPromise);
    }
    if (redisConnected && diagnostics.hasWorkerReadyOutput()) {
      const metaKeys = await redis.keys(`${smokeBullMqPrefix}:*:meta`);
      const paused = await Promise.all(metaKeys.map((key) => redis.hget(key, 'paused')));
      if (metaKeys.length > 0 && paused.every((value) => value === '1')) {
        process.stdout.write('✓ Worker shutdown paused its queue namespace\n');
      } else {
        process.stderr.write('Worker shutdown queue pause was not observed\n');
        process.exitCode = 1;
      }
    }
    if (redisConnected) {
      await deleteRedisNamespace(redis, smokeBullMqPrefix);
      await redis.quit();
    }
  }

  if (requestedSignal) {
    process.exitCode = 130;
  }
}

function createRedisClient() {
  const host = requireEnv('REDIS_HOST');
  const port = parsePositiveInteger(requireEnv('REDIS_PORT'), 'REDIS_PORT');
  const db = parseNonNegativeInteger(requireEnv('REDIS_DB'), 'REDIS_DB');
  const password = normalizeOptionalText(process.env.REDIS_PASSWORD);
  const tls = process.env.REDIS_TLS === 'true' ? {} : undefined;
  return new Redis({
    host,
    port,
    db,
    password,
    tls,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
}

function resolveSmokeDisabledCapabilities() {
  const disabled = new Set(
    (process.env.CAPABILITY_DISABLED_IDS || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
  disabled.add('ai.execution');
  disabled.add('ai.workflow');
  disabled.add('runtime.email-delivery');
  return [...disabled].join(',');
}

async function reservePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : null;
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  if (typeof port !== 'number') {
    throw new Error('failed to reserve a smoke port');
  }
  return port;
}

async function isApiReady(input) {
  try {
    const response = await fetch(`http://${input.host}:${input.port}/health/readiness`);
    if (!response.ok) {
      return false;
    }
    const payload = await response.json();
    return payload?.status === 'ready' && payload?.service === 'api';
  } catch {
    return false;
  }
}

async function deleteRedisNamespace(redis, prefix) {
  let cursor = '0';
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', `${prefix}:*`, 'COUNT', 100);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    cursor = nextCursor;
  } while (cursor !== '0');
}

async function waitUntil(input) {
  let lastError = null;
  while (Date.now() < input.deadline) {
    try {
      if (await input.check()) {
        return true;
      }
    } catch (error) {
      lastError = error;
    }
    await delay(POLL_INTERVAL_MS);
  }
  if (input.throwOnTimeout === false) {
    return false;
  }
  const suffix = lastError ? `: ${formatError(lastError)}` : '';
  throw new Error(`timed out waiting for ${input.description}${suffix}`);
}

function observeChildExit(child) {
  return new Promise((resolve) => {
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
}

async function stopChildProcess(childExitPromise) {
  if (!childProcess || childProcess.exitCode !== null || childProcess.signalCode !== null) {
    return;
  }
  signalChildProcess('SIGINT');
  const exited = await Promise.race([
    childExitPromise.then(() => true),
    delay(SHUTDOWN_TIMEOUT_MS).then(() => false),
  ]);
  if (exited) {
    return;
  }
  signalChildProcess('SIGKILL');
  await childExitPromise;
}

function signalChildProcess(signal) {
  if (!childProcess || childProcess.exitCode !== null || childProcess.signalCode !== null) {
    return;
  }
  try {
    if (process.platform !== 'win32' && childProcess.pid) {
      process.kill(-childProcess.pid, signal);
      return;
    }
    childProcess.kill(signal);
  } catch (error) {
    if (error?.code !== 'ESRCH') {
      throw error;
    }
  }
}

function createDiagnostics() {
  const lines = [];
  let apiOutput = false;
  let workerOutput = false;
  let workerReadyOutput = false;
  return {
    observe(stream) {
      stream.setEncoding('utf8');
      stream.on('data', (chunk) => {
        const text = stripAnsi(chunk);
        apiOutput ||= text.includes('[api]');
        workerOutput ||= text.includes('[worker]');
        workerReadyOutput ||= text.includes('Worker 已启动并完成基础设施装配');
        for (const line of text.split(/\r?\n/)) {
          if (line.trim().length === 0) {
            continue;
          }
          lines.push(line);
          if (lines.length > MAX_DIAGNOSTIC_LINES) {
            lines.shift();
          }
        }
      });
    },
    hasApiOutput: () => apiOutput,
    hasWorkerOutput: () => workerOutput,
    hasWorkerReadyOutput: () => workerReadyOutput,
    print() {
      if (lines.length === 0) {
        return;
      }
      process.stderr.write(`Recent dev output:\n${lines.join('\n')}\n`);
    },
  };
}

function requireEnv(name) {
  const value = normalizeOptionalText(process.env[name]);
  if (!value) {
    throw new Error(`${name} is required for dev runtime smoke`);
  }
  return value;
}

function parsePositiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function parseNonNegativeInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return parsed;
}

function normalizeOptionalText(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripAnsi(value) {
  return value.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '');
}

function formatExit(exit) {
  return exit.signal ? `signal=${exit.signal}` : `code=${exit.code}`;
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

void main().catch((error) => {
  process.stderr.write(`Dev runtime smoke crashed: ${formatError(error)}\n`);
  process.exitCode = 1;
});
