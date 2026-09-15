import { getQueueToken } from '@nestjs/bullmq';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ApiModule } from '@src/bootstraps/api/api.module';
import { WorkerModule } from '@src/bootstraps/worker/worker.module';
import { initGraphQLSchema } from '@src/adapters/api/graphql/schema/schema.init';
import type {
  AiProviderClient,
  GenerateAiContentInput,
  GenerateAiContentResult,
} from '@core/ai/ai-provider.interface';
import { CAPABILITY_ERROR, DomainError, THIRDPARTY_ERROR } from '@core/common/errors/domain-error';
import { OpenAiGenerateProvider } from '@src/infrastructure/ai/providers/openai/openai-generate.provider';
import { QwenGenerateProvider } from '@src/infrastructure/ai/providers/qwen/qwen-generate.provider';
import { LocalMockAiProvider } from '@src/infrastructure/ai/providers/local/local-mock-ai.provider';
import { BULLMQ_QUEUES } from '@src/infrastructure/bullmq/bullmq.constants';
import { BullMqWorkerRuntime } from '@src/infrastructure/bullmq/worker.runtime';
import { AiWorkflowContextEntity } from '@src/modules/ai-workflow-context/ai-workflow-context.entity';
import type { AiWorkflowJsonPayload } from '@src/modules/ai-workflow-context/ai-workflow-context.types';
import { AiProviderCallRecordEntity } from '@src/modules/ai-provider-call-record/ai-provider-call-record.entity';
import { AsyncTaskRecordEntity } from '@src/modules/async-task-record/async-task-record.entity';
import { AiWorkerService } from '@src/modules/common/ai-worker/ai-worker.service';
import { AiProviderRegistry } from '@src/modules/common/ai-worker/providers/ai-provider-registry';
import {
  CAPABILITY_STATE_READER,
  type CapabilityStateReader,
} from '@src/modules/common/capability-state-reader.contract';
import { CreateAndAdmitAiWorkflowUsecase } from '@src/usecases/ai-workflow/create-and-admit-ai-workflow.usecase';
import { AiWorkflowUsecasesModule } from '@src/usecases/ai-workflow/ai-workflow-usecases.module';
import { RunAiWorkflowHousekeepingUsecase } from '@src/usecases/ai-workflow/run-ai-workflow-housekeeping.usecase';
import { AiWorkflowJobProcessor } from '@src/adapters/worker/ai-workflow/ai-workflow-job.processor';
import { AiWorkflowWorkerActivationUsecase } from '@src/usecases/ai-worker/ai-workflow-worker-activation.usecase';
import { Queue, type Job } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';

// Only infrastructure provider clients are replaced. Registry, services, handlers, gates,
// transaction runner, API/Worker roots, queue transport and persistence are real.
class ControlledProvider implements AiProviderClient {
  readonly calls: GenerateAiContentInput[] = [];
  failuresRemaining = 0;
  alwaysFail = false;
  constructor(readonly name: string) {}
  generate(input: GenerateAiContentInput): Promise<GenerateAiContentResult> {
    this.calls.push(input);
    if (this.alwaysFail || this.failuresRemaining-- > 0) {
      return Promise.reject(
        new DomainError(THIRDPARTY_ERROR.PROVIDER_API_ERROR, 'controlled provider unavailable', {
          provider: this.name,
          providerErrorCode: 'controlled_failure',
        }),
      );
    }
    return Promise.resolve({
      accepted: true,
      outputText: 'provider-owned result 独立结果',
      provider: this.name,
      // Deliberately differs from the request to detect accidental request-value fallback.
      model: 'provider-resolved-model-17',
      providerJobId: 'provider-job-17',
      providerRequestId: 'provider-request-23',
      providerStatus: 'succeeded',
    });
  }
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
async function eventually<T>(read: () => Promise<T>, accept: (value: T) => boolean): Promise<T> {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const value = await read();
    if (accept(value)) return value;
    await delay(100);
  }
  throw new Error('collaboration state did not converge');
}

describe('ai.workflow consumes ai.execution: real composition', () => {
  let api: INestApplication;
  let worker: INestApplication;
  let queue: Queue;
  let db: DataSource;
  let runtime: BullMqWorkerRuntime;
  let admission: CreateAndAdmitAiWorkflowUsecase;
  const openai = new ControlledProvider('openai');
  const qwen = new ControlledProvider('qwen');
  const local = new ControlledProvider('mock');
  const oldMode = process.env.AI_PROVIDER_MODE;
  const oldDisabled = process.env.CAPABILITY_DISABLED_IDS;

  async function boot(disabled = ''): Promise<void> {
    process.env.AI_PROVIDER_MODE = 'remote';
    process.env.CAPABILITY_DISABLED_IDS = disabled;
    const apiModule = await Test.createTestingModule({
      imports: [ApiModule, AiWorkflowUsecasesModule],
    }).compile();
    api = apiModule.createNestApplication();
    await api.init();
    const workerModule = await Test.createTestingModule({ imports: [WorkerModule] })
      .overrideProvider(OpenAiGenerateProvider)
      .useValue(openai)
      .overrideProvider(QwenGenerateProvider)
      .useValue(qwen)
      .overrideProvider(LocalMockAiProvider)
      .useValue(local)
      .compile();
    worker = workerModule.createNestApplication();
    await worker.init();
    queue = api.get<Queue>(getQueueToken(BULLMQ_QUEUES.AI_WORKFLOW));
    db = api.get(DataSource);
    runtime = worker.get(BullMqWorkerRuntime);
    admission = api.get(CreateAndAdmitAiWorkflowUsecase);
  }
  async function close(): Promise<void> {
    if (worker) await worker.close();
    if (api) await api.close();
  }
  async function create(inputPayload: AiWorkflowJsonPayload) {
    const unique = randomUUID();
    const result = await admission.execute({
      workflowType: 'generic_text_generate',
      workflowDedupKey: `collaboration-${unique}`,
      inputPayload,
      traceId: `collaboration-${unique}`,
      source: 'system',
      bizType: 'collaboration',
      bizKey: unique,
      provider: 'openai',
      model: 'consumer-model-42',
    });
    expect(result.status).toBe('QUEUED');
    if (result.status !== 'QUEUED') throw new Error('expected real queue admission');
    return result;
  }
  function payload(userPrompt = 'Explain the result'): AiWorkflowJsonPayload {
    return {
      userPrompt,
      systemPrompt: 'Be concise.',
      context: 'Context from consumer.',
      provider: 'openai',
      model: 'consumer-model-42',
    };
  }
  async function settled(jobId: string, state: 'completed' | 'failed'): Promise<Job> {
    const job = await queue.getJob(jobId);
    if (!job) throw new Error('admitted job missing');
    const final = await eventually(
      () => job.getState(),
      (value) => value === 'completed' || value === 'failed',
    );
    expect(final).toBe(state);
    return job;
  }
  function context(workflowId: string) {
    return db.getRepository(AiWorkflowContextEntity).findOneByOrFail({ workflowId });
  }
  async function audit(jobId: string, status: string) {
    return eventually(
      () =>
        db
          .getRepository(AsyncTaskRecordEntity)
          .findOneBy({ queueName: BULLMQ_QUEUES.AI_WORKFLOW, jobId }),
      (record) => record?.status === status,
    );
  }
  function calls(traceId: string) {
    return db
      .getRepository(AiProviderCallRecordEntity)
      .find({ where: { traceId }, order: { callSeq: 'ASC' } });
  }

  beforeAll(async () => {
    initGraphQLSchema();
    await boot();
  }, 60_000);
  afterAll(async () => {
    await close();
    if (oldMode === undefined) delete process.env.AI_PROVIDER_MODE;
    else process.env.AI_PROVIDER_MODE = oldMode;
    if (oldDisabled === undefined) delete process.env.CAPABILITY_DISABLED_IDS;
    else process.env.CAPABILITY_DISABLED_IDS = oldDisabled;
  });
  beforeEach(() => {
    openai.calls.length = 0;
    qwen.calls.length = 0;
    local.calls.length = 0;
    openai.failuresRemaining = 0;
    openai.alwaysFail = false;
  });

  it('passes the promised provider/model/prompt/metadata and persists the provider result', async () => {
    expect(worker.get(AiWorkerService)).toBeInstanceOf(AiWorkerService);
    expect(worker.get(AiProviderRegistry)).toBeInstanceOf(AiProviderRegistry);
    const admitted = await create(payload());
    await settled(admitted.jobId, 'completed');
    expect(openai.calls).toEqual([
      {
        provider: 'openai',
        model: 'consumer-model-42',
        prompt:
          'System:\nBe concise.\n\nContext:\nContext from consumer.\n\nUser:\nExplain the result',
        metadata: {
          workflowId: admitted.context.workflowId,
          workflowType: 'generic_text_generate',
          traceId: admitted.traceId,
        },
      },
    ]);
    expect(qwen.calls).toHaveLength(0);
    expect(local.calls).toHaveLength(0);
    expect(await context(admitted.context.workflowId)).toMatchObject({
      status: 'SUCCEEDED',
      outputPayloadJson: {
        outputText: 'provider-owned result 独立结果',
        provider: 'openai',
        model: 'provider-resolved-model-17',
        providerJobId: 'provider-job-17',
        providerRequestId: 'provider-request-23',
      },
    });
    expect(await audit(admitted.jobId, 'succeeded')).toMatchObject({
      attemptCount: 1,
      reason: 'worker_completed',
    });
    expect(await calls(admitted.traceId)).toMatchObject([
      { provider: 'openai', model: 'provider-resolved-model-17', providerStatus: 'succeeded' },
    ]);
  }, 60_000);

  it('rejects invalid input before any provider call or output write', async () => {
    const admitted = await create(payload(''));
    await settled(admitted.jobId, 'failed');
    expect(await context(admitted.context.workflowId)).toMatchObject({
      status: 'FAILED',
      errorCode: 'WORKFLOW_INPUT_PAYLOAD_INVALID',
      outputPayloadJson: null,
    });
    expect(openai.calls).toHaveLength(0);
    expect(qwen.calls).toHaveLength(0);
    expect(local.calls).toHaveLength(0);
    expect(await calls(admitted.traceId)).toHaveLength(0);
    await audit(admitted.jobId, 'failed');
  }, 60_000);

  it('retries a temporary provider failure and succeeds on the third attempt', async () => {
    openai.failuresRemaining = 2;
    const admitted = await create(payload());
    await settled(admitted.jobId, 'completed');
    expect(openai.calls).toHaveLength(3);
    expect(openai.calls.every((input) => input.model === 'consumer-model-42')).toBe(true);
    expect(await context(admitted.context.workflowId)).toMatchObject({
      status: 'SUCCEEDED',
      errorCode: null,
      outputPayloadJson: { outputText: 'provider-owned result 独立结果' },
    });
    expect(await audit(admitted.jobId, 'succeeded')).toMatchObject({ attemptCount: 3 });
    expect((await calls(admitted.traceId)).map((record) => record.providerStatus)).toEqual([
      'failed',
      'failed',
      'succeeded',
    ]);
  }, 60_000);

  it('exhausts retries as failure without inventing output or success audit', async () => {
    openai.alwaysFail = true;
    const admitted = await create(payload());
    await settled(admitted.jobId, 'failed');
    expect(openai.calls).toHaveLength(3);
    expect(await context(admitted.context.workflowId)).toMatchObject({
      status: 'FAILED',
      errorCode: 'WORKFLOW_PROVIDER_FAILED',
      outputPayloadJson: null,
    });
    expect(await audit(admitted.jobId, 'failed')).toMatchObject({
      attemptCount: 3,
      reason: expect.stringContaining('controlled provider unavailable'),
    });
    expect((await calls(admitted.traceId)).map((record) => record.providerStatus)).toEqual([
      'failed',
      'failed',
      'failed',
    ]);
  }, 60_000);

  it('reprocesses a succeeded job through the real queue without invoking the provider again', async () => {
    const admitted = await create(payload());
    const job = await settled(admitted.jobId, 'completed');
    await audit(admitted.jobId, 'succeeded');
    const before = await context(admitted.context.workflowId);
    await runtime.stop();
    await job.retry('completed');
    expect(await job.getState()).not.toBe('completed');
    await runtime.start();
    await settled(admitted.jobId, 'completed');
    expect(openai.calls).toHaveLength(1);
    expect(await calls(admitted.traceId)).toHaveLength(1);
    expect((await context(admitted.context.workflowId)).outputPayloadJson).toEqual(
      before.outputPayloadJson,
    );
  }, 60_000);

  it('Execution disablement rejects admission, leaves backlog unclaimed, and permits only owned terminal drain', async () => {
    await runtime.stop();
    const backlog = await create(payload());
    const terminal = await create(payload());
    // Fixture represents an already-owned terminal fact whose audit needs reconciliation.
    await db
      .getRepository(AiWorkflowContextEntity)
      .update({ workflowId: terminal.context.workflowId }, { status: 'CANCELLED' });
    await close();
    await boot('ai.execution');
    const state = worker.get<CapabilityStateReader>(CAPABILITY_STATE_READER);
    expect(state.getState('ai.execution').effectiveState).toBe('disabled');
    expect(state.getState('ai.workflow')).toMatchObject({
      configuredState: 'enabled',
      effectiveState: 'blocked',
      rootBlockers: [{ capabilityId: 'ai.execution', effectiveState: 'disabled' }],
    });
    expect(worker.get(AiWorkflowWorkerActivationUsecase).shouldRun()).toBe(false);
    expect(worker.get(AiWorkflowJobProcessor).worker.isRunning()).toBe(false);
    const countBefore = await db.getRepository(AiWorkflowContextEntity).count();
    await expect(
      admission.execute({
        workflowType: 'generic_text_generate',
        workflowDedupKey: randomUUID(),
        inputPayload: payload(),
        source: 'system',
        bizType: 'collaboration',
        bizKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: CAPABILITY_ERROR.UNAVAILABLE });
    expect(await db.getRepository(AiWorkflowContextEntity).count()).toBe(countBefore);
    await delay(300);
    const queued = await queue.getJob(backlog.jobId);
    expect(await queued?.getState()).toBe('waiting');
    expect(queued?.attemptsMade).toBe(0);
    expect(await context(backlog.context.workflowId)).toMatchObject({
      status: 'QUEUED',
      outputPayloadJson: null,
    });
    const drained = await api.get(RunAiWorkflowHousekeepingUsecase).execute({ limit: 100 });
    expect(drained.admission.scanned).toBe(0);
    expect(drained.staleQueued.scanned).toBe(0);
    expect(drained.asyncTaskReconcile.succeeded).toBeGreaterThanOrEqual(1);
    expect(await audit(terminal.jobId, 'cancelled')).toMatchObject({ status: 'cancelled' });
    expect((await queue.getJob(backlog.jobId))?.attemptsMade).toBe(0);
    expect(openai.calls).toHaveLength(0);
    expect(qwen.calls).toHaveLength(0);
    expect(local.calls).toHaveLength(0);
    expect(await calls(backlog.traceId)).toHaveLength(0);
    expect(await calls(terminal.traceId)).toHaveLength(0);
  }, 60_000);
});
