/// <reference types="node" />

import 'reflect-metadata';

import type { CapabilityManifest, CapabilityProcess } from '@app-types/common/capability.types';
import { CAPABILITY_MANIFEST_METADATA_KEY } from '@src/infrastructure/capability/capability.decorators';
import { promises as fs } from 'node:fs';
import path from 'node:path';

type OutputFormat = 'table' | 'json' | 'md';
type ProcessFilter = CapabilityProcess | 'all';

interface CliOptions {
  readonly format: OutputFormat;
  readonly process: ProcessFilter;
  readonly writePath?: string;
  readonly check: boolean;
}

interface CapabilityListEntry {
  readonly manifest: CapabilityManifest;
  readonly sourceFile: string;
  readonly exportName: string;
}

const PROJECT_ROOT = process.cwd();
const SRC_ROOT = path.join(PROJECT_ROOT, 'src');

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const entries = filterByProcess(await collectCapabilityManifests(), options.process);
  const output = render(entries, options);

  if (options.check) {
    if (!options.writePath) {
      throw new Error('--check requires --write=<path>');
    }
    await assertGeneratedFileMatches(options.writePath, output);
    return;
  }

  if (options.writePath) {
    const targetPath = path.resolve(PROJECT_ROOT, options.writePath);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, output, 'utf8');
    console.log(`Wrote ${path.relative(PROJECT_ROOT, targetPath)}`);
    return;
  }

  console.log(output);
}

function parseArgs(argv: readonly string[]): CliOptions {
  let format: OutputFormat = 'table';
  let processFilter: ProcessFilter = 'all';
  let writePath: string | undefined;
  let check = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg || arg === '--') {
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
    if (arg === '--check') {
      check = true;
      continue;
    }
    if (arg.startsWith('--format=')) {
      format = parseFormat(arg.slice('--format='.length));
      continue;
    }
    if (arg === '--format') {
      format = parseFormat(readNextArg(argv, index, '--format'));
      index += 1;
      continue;
    }
    if (arg.startsWith('--process=')) {
      processFilter = parseProcessFilter(arg.slice('--process='.length));
      continue;
    }
    if (arg === '--process') {
      processFilter = parseProcessFilter(readNextArg(argv, index, '--process'));
      index += 1;
      continue;
    }
    if (arg.startsWith('--write=')) {
      writePath = parseWritePath(arg.slice('--write='.length));
      continue;
    }
    if (arg === '--write') {
      writePath = parseWritePath(readNextArg(argv, index, '--write'));
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { format, process: processFilter, writePath, check };
}

function readNextArg(argv: readonly string[], index: number, optionName: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${optionName} requires a value`);
  }
  return value;
}

function parseFormat(value: string): OutputFormat {
  if (value === 'table' || value === 'json' || value === 'md') {
    return value;
  }
  throw new Error(`Unsupported format: ${value}`);
}

function parseProcessFilter(value: string): ProcessFilter {
  if (value === 'all' || value === 'api' || value === 'worker') {
    return value;
  }
  throw new Error(`Unsupported process filter: ${value}`);
}

function parseWritePath(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error('--write requires a non-empty path');
  }
  return normalized;
}

function printHelp(): void {
  console.log(`Usage: npm run capability:list -- [options]

Options:
  --format=table|md|json     Output format. Default: table.
  --process=all|api|worker   Filter by capability process. Default: all.
  --write=<path>             Write output to a file instead of stdout.
  --check                    Compare generated output with --write target.
  --help                     Show this help.

Examples:
  npm run capability:list
  npm run capability:list -- --format=md
  npm run capability:list -- --process=worker --format=json
  npm run capability:docs
  npm run capability:docs:check`);
}

async function assertGeneratedFileMatches(writePath: string, output: string): Promise<void> {
  const targetPath = path.resolve(PROJECT_ROOT, writePath);
  let current: string;
  try {
    current = await fs.readFile(targetPath, 'utf8');
  } catch (error: unknown) {
    if (isErrnoException(error) && error.code === 'ENOENT') {
      throw new Error(
        `Generated capability docs are missing: ${path.relative(PROJECT_ROOT, targetPath)}. Run npm run capability:docs.`,
      );
    }
    throw error;
  }

  if (current !== output) {
    throw new Error(
      `Generated capability docs are stale: ${path.relative(PROJECT_ROOT, targetPath)}. Run npm run capability:docs.`,
    );
  }

  console.log(`Generated capability docs are current: ${path.relative(PROJECT_ROOT, targetPath)}`);
}

async function collectCapabilityManifests(): Promise<readonly CapabilityListEntry[]> {
  const files = await discoverCapabilityFiles(SRC_ROOT);
  const entries: CapabilityListEntry[] = [];

  for (const file of files) {
    const importedModule = (await import(file)) as Record<string, unknown>;
    for (const [exportName, exportedValue] of Object.entries(importedModule)) {
      const manifest = readCapabilityManifestMetadata(exportedValue);
      if (!manifest) {
        continue;
      }
      entries.push({
        manifest,
        sourceFile: toProjectPath(file),
        exportName,
      });
    }
  }

  return [...dedupeEntries(entries)].sort((left, right) =>
    left.manifest.id.localeCompare(right.manifest.id),
  );
}

async function discoverCapabilityFiles(directory: string): Promise<readonly string[]> {
  const dirents = await fs.readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const dirent of dirents) {
    const currentPath = path.join(directory, dirent.name);
    if (dirent.isDirectory()) {
      files.push(...(await discoverCapabilityFiles(currentPath)));
      continue;
    }
    if (dirent.isFile() && (await isCapabilityCandidateFile(currentPath))) {
      files.push(currentPath);
    }
  }

  return files.sort();
}

async function isCapabilityCandidateFile(filePath: string): Promise<boolean> {
  const relativePath = toProjectPath(filePath);
  if (!relativePath.endsWith('.ts') || relativePath.endsWith('.d.ts')) {
    return false;
  }
  if (relativePath.endsWith('.spec.ts') || relativePath.includes('/__fixtures__/')) {
    return false;
  }
  const source = await fs.readFile(filePath, 'utf8');
  return source.includes('CapabilityManifestProvider');
}

function readCapabilityManifestMetadata(exportedValue: unknown): CapabilityManifest | null {
  if (typeof exportedValue !== 'function') {
    return null;
  }
  const metadata = Reflect.getMetadata(CAPABILITY_MANIFEST_METADATA_KEY, exportedValue) as unknown;
  return isCapabilityManifest(metadata) ? metadata : null;
}

function isCapabilityManifest(value: unknown): value is CapabilityManifest {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === 'string' &&
    isCapabilityKind(value.kind) &&
    typeof value.displayName === 'string' &&
    typeof value.version === 'string' &&
    Array.isArray(value.processes) &&
    value.processes.every(isCapabilityProcess)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCapabilityKind(value: unknown): value is CapabilityManifest['kind'] {
  return value === 'platform' || value === 'technical' || value === 'business';
}

function isCapabilityProcess(value: unknown): value is CapabilityProcess {
  return value === 'api' || value === 'worker';
}

function dedupeEntries(entries: readonly CapabilityListEntry[]): readonly CapabilityListEntry[] {
  const byKey = new Map<string, CapabilityListEntry>();
  for (const entry of entries) {
    const key = `${entry.manifest.id}:${entry.sourceFile}:${entry.exportName}`;
    byKey.set(key, entry);
  }
  return [...byKey.values()];
}

function filterByProcess(
  entries: readonly CapabilityListEntry[],
  processFilter: ProcessFilter,
): readonly CapabilityListEntry[] {
  if (processFilter === 'all') {
    return entries;
  }
  return entries.filter((entry) => entry.manifest.processes.includes(processFilter));
}

function render(entries: readonly CapabilityListEntry[], options: CliOptions): string {
  if (options.format === 'json') {
    return renderJson(entries, options);
  }
  if (options.format === 'md') {
    return renderMarkdown(entries, options);
  }
  return renderTable(entries, options);
}

function renderJson(entries: readonly CapabilityListEntry[], options: CliOptions): string {
  return `${JSON.stringify(
    {
      generatedBy: 'npm run capability:list',
      process: options.process,
      capabilities: entries.map((entry) => ({
        ...entry.manifest,
        sourceFile: entry.sourceFile,
        exportName: entry.exportName,
      })),
    },
    null,
    2,
  )}\n`;
}

function renderMarkdown(entries: readonly CapabilityListEntry[], options: CliOptions): string {
  const lines = [
    '<!-- generated by npm run capability:docs; do not edit manually -->',
    '',
    '# Current Capability Manifest',
    '',
    `Process filter: \`${options.process}\``,
    '',
    'This file is generated from `@CapabilityManifestProvider(...)` metadata. The manifest code is the source of truth.',
    '',
    '## Runtime Config IDs',
    '',
    '`CAPABILITY_DISABLED_IDS`, `CAPABILITY_KILL_SWITCH_IDS`, and `CAPABILITY_OPERATION_DISABLED_KEYS` should reference the IDs below.',
    '',
    ...entries.map(
      (entry) =>
        `- \`${entry.manifest.id}\` - ${entry.manifest.displayName} (${entry.manifest.kind}; ${entry.manifest.processes.join(', ')})`,
    ),
    '',
    '## Capabilities',
    '',
    '| ID | Name | Kind | Processes | Providers | Queues | Operations | Source |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...entries.map((entry) => renderMarkdownRow(entry)),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function renderMarkdownRow(entry: CapabilityListEntry): string {
  const manifest = entry.manifest;
  return [
    manifest.id,
    manifest.displayName,
    manifest.kind,
    manifest.processes.join(', '),
    summarizeProviders(manifest),
    summarizeQueues(manifest),
    summarizeOperations(manifest),
    `${entry.sourceFile}#${entry.exportName}`,
  ]
    .map(escapeMarkdownCell)
    .join(' | ')
    .replace(/^/, '| ')
    .replace(/$/, ' |');
}

function renderTable(entries: readonly CapabilityListEntry[], options: CliOptions): string {
  const rows = entries.map((entry) => [
    entry.manifest.id,
    entry.manifest.kind,
    entry.manifest.processes.join(','),
    entry.manifest.displayName,
  ]);
  const widths = [2, 4, 9, 4].map((minimumWidth, index) =>
    Math.max(minimumWidth, ...rows.map((row) => row[index]?.length ?? 0)),
  );
  const header = ['ID', 'Kind', 'Processes', 'Name'];
  const lines = [
    `Capability manifests (${options.process}; ${entries.length})`,
    formatTableRow(header, widths),
    formatTableRow(widths.map((width) => '-'.repeat(width)), widths),
    ...rows.map((row) => formatTableRow(row, widths)),
  ];
  return lines.join('\n');
}

function formatTableRow(cells: readonly string[], widths: readonly number[]): string {
  return cells.map((cell, index) => cell.padEnd(widths[index] ?? cell.length)).join('  ');
}

function summarizeProviders(manifest: CapabilityManifest): string {
  const providers = manifest.contributions?.providers ?? [];
  if (providers.length === 0) {
    return '-';
  }
  return providers
    .map((provider) => `${provider.providerKind}:${provider.providerName}`)
    .join('; ');
}

function summarizeQueues(manifest: CapabilityManifest): string {
  const queues = manifest.contributions?.queues ?? [];
  if (queues.length === 0) {
    return '-';
  }
  return queues
    .map(
      (queue) =>
        `${queue.operationKind}:${queue.operation}->${queue.queueName}/${queue.jobName}${queue.dedupKeyMapping ? ` (${queue.dedupKeyMapping})` : ''}`,
    )
    .join('; ');
}

function summarizeOperations(manifest: CapabilityManifest): string {
  const commands = manifest.operations?.commands ?? [];
  const queries = manifest.operations?.queries ?? [];
  const events = manifest.operations?.events ?? [];
  const operations = [...commands, ...queries, ...events];
  if (operations.length === 0) {
    return '-';
  }
  return operations.map((operation) => `${operation.kind}:${operation.name}`).join('; ');
}

function escapeMarkdownCell(value: string): string {
  return value.replaceAll('|', '\\|').replace(/\s+/g, ' ').trim();
}

function toProjectPath(filePath: string): string {
  return path.relative(PROJECT_ROOT, filePath).split(path.sep).join('/');
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

main().catch((error: unknown) => {
  console.error(formatError(error));
  process.exitCode = 1;
});
