/// <reference types="jest" />
// src/modules/ai-workflow-context/ai-workflow-context.service.spec.ts
import { AI_WORKFLOW_CONTEXT_ERROR } from '@core/common/errors/domain-error';
import type { Repository, UpdateResult } from 'typeorm';
import { AiWorkflowContextEntity } from './ai-workflow-context.entity';
import { AiWorkflowContextService } from './ai-workflow-context.service';
import type { AiWorkflowJsonPayload } from './ai-workflow-context.types';

describe('AiWorkflowContextService', () => {
  let repository: {
    readonly findOne: jest.Mock;
    readonly create: jest.Mock;
    readonly save: jest.Mock;
    readonly update: jest.Mock;
    readonly createQueryBuilder: jest.Mock;
  };
  let service: AiWorkflowContextService;

  beforeEach(() => {
    repository = {
      findOne: jest.fn(),
      create: jest.fn((input: Partial<AiWorkflowContextEntity>) => createEntity(input)),
      save: jest.fn((entity: AiWorkflowContextEntity) => Promise.resolve(entity)),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    service = new AiWorkflowContextService(
      repository as unknown as Repository<AiWorkflowContextEntity>,
    );
  });

  it('creates a workflow context with hashed dedup key and normalized payload', async () => {
    repository.findOne.mockResolvedValueOnce(null);

    const result = await service.createContext({
      workflowType: ' generic_text_generate ',
      workflowDedupKey: 'dedup-1',
      inputPayload: {
        z: 'last',
        a: 1,
      },
      traceId: ' trace-1 ',
      bizType: 'demo',
      bizKey: 'biz-1',
      source: 'user_action',
      provider: 'mock',
      model: 'model-1',
    });

    expect(result.status).toBe('CREATED');
    expect(result.context.workflowType).toBe('generic_text_generate');
    expect(result.context.traceId).toBe('trace-1');
    expect(result.context.status).toBe('CREATED');
    expect(result.context.inputPayloadJson).toEqual({ a: 1, z: 'last' });
    expect(Buffer.isBuffer(result.context.workflowDedupHash)).toBe(true);
    expect(result.context.workflowDedupHash?.byteLength).toBe(32);
    expect(result.context.workflowDedupActiveHash?.equals(result.context.workflowDedupHash!)).toBe(
      true,
    );
    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  it('returns existing active context for the same workflow dedup key', async () => {
    const existing = createEntity({
      workflowId: 'workflow-existing',
      status: 'QUEUED',
      workflowDedupHash: Buffer.alloc(32, 1),
      workflowDedupActiveHash: Buffer.alloc(32, 1),
    });
    repository.findOne.mockResolvedValueOnce(existing);

    const result = await service.createContext({
      workflowType: 'generic_text_generate',
      workflowDedupKey: 'dedup-1',
      inputPayload: { prompt: 'hello' },
      bizType: 'demo',
      bizKey: 'biz-1',
      source: 'user_action',
    });

    expect(result).toMatchObject({
      status: 'EXISTING_ACTIVE',
      context: {
        workflowId: 'workflow-existing',
        status: 'QUEUED',
      },
    });
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('returns conflict with current context when expected status does not match', async () => {
    const current = createEntity({ status: 'QUEUED' });
    repository.update.mockResolvedValueOnce({ affected: 0 } satisfies Partial<UpdateResult>);
    repository.findOne.mockResolvedValueOnce(current);

    const result = await service.markAdmissionWaiting({
      workflowId: 'workflow-1',
      expectedStatuses: ['CREATED'],
      nextEnqueueAt: new Date('2026-01-01T00:01:00.000Z'),
      admissionExpiresAt: new Date('2026-01-02T00:00:00.000Z'),
      admissionReason: 'QUEUE_UNAVAILABLE',
    });

    expect(result.status).toBe('CONFLICT');
    expect(result.context?.status).toBe('QUEUED');
  });

  it('clears active dedup hash when workflow enters a terminal status', async () => {
    const succeeded = createEntity({
      status: 'SUCCEEDED',
      workflowDedupActiveHash: null,
      errorCode: null,
      errorMessage: null,
    });
    repository.update.mockResolvedValueOnce({ affected: 1 } satisfies Partial<UpdateResult>);
    repository.findOne.mockResolvedValueOnce(succeeded);

    const result = await service.markSucceeded({
      workflowId: 'workflow-1',
      expectedStatuses: ['PROCESSING'],
    });

    expect(result.status).toBe('UPDATED');
    expect(result.context?.status).toBe('SUCCEEDED');
    expect(result.context?.workflowDedupActiveHash).toBeNull();
    expect(repository.update).toHaveBeenCalledWith(
      expect.objectContaining({ workflowId: 'workflow-1' }),
      expect.objectContaining({
        status: 'SUCCEEDED',
        workflowDedupActiveHash: null,
      }),
    );
  });

  it('includes cancelled workflows when listing terminal contexts', async () => {
    const queryBuilder = createQueryBuilderMock([]);
    repository.createQueryBuilder.mockReturnValueOnce(queryBuilder);

    await service.listTerminalContexts({ limit: 10 });

    expect(queryBuilder.where).toHaveBeenCalledWith('context.status IN (:...statuses)', {
      statuses: ['SUCCEEDED', 'FAILED', 'CANCELLED'],
    });
  });

  it('rejects payloads larger than 1 MiB', async () => {
    await expect(
      service.createContext({
        workflowType: 'generic_text_generate',
        inputPayload: 'x'.repeat(1024 * 1024 + 1),
        bizType: 'demo',
        bizKey: 'biz-1',
        source: 'user_action',
      }),
    ).rejects.toMatchObject({
      code: AI_WORKFLOW_CONTEXT_ERROR.PAYLOAD_TOO_LARGE,
    });
  });

  it('rejects null root payloads to avoid mixing JSON null with missing payload state', async () => {
    await expect(
      service.createContext({
        workflowType: 'generic_text_generate',
        inputPayload: null as unknown as AiWorkflowJsonPayload,
        bizType: 'demo',
        bizKey: 'biz-1',
        source: 'user_action',
      }),
    ).rejects.toMatchObject({
      code: AI_WORKFLOW_CONTEXT_ERROR.PAYLOAD_INVALID,
    });
  });
});

function createEntity(overrides: Partial<AiWorkflowContextEntity> = {}): AiWorkflowContextEntity {
  const now = new Date('2026-01-01T00:00:00.000Z');
  const base: AiWorkflowContextEntity = {
    workflowId: 'workflow-1',
    workflowType: 'generic_text_generate',
    workflowDedupHash: Buffer.alloc(32, 1),
    workflowDedupActiveHash: Buffer.alloc(32, 1),
    traceId: 'trace-1',
    queueName: null,
    jobName: null,
    jobId: null,
    asyncTaskRecordId: null,
    bizType: 'demo',
    bizKey: 'biz-1',
    bizSubKey: null,
    source: 'user_action',
    actorAccountId: null,
    actorActiveRole: null,
    provider: 'mock',
    model: 'model-1',
    status: 'CREATED',
    inputPayloadJson: { prompt: 'hello' },
    outputPayloadJson: null,
    admissionAttemptCount: 0,
    nextEnqueueAt: null,
    admissionExpiresAt: null,
    admissionReason: null,
    errorCode: null,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
  };
  return {
    ...base,
    ...overrides,
  };
}

function createQueryBuilderMock(result: AiWorkflowContextEntity[]) {
  const queryBuilder = {
    select: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
    take: jest.fn(),
    getMany: jest.fn(() => Promise.resolve(result)),
  };
  queryBuilder.select.mockReturnValue(queryBuilder);
  queryBuilder.where.mockReturnValue(queryBuilder);
  queryBuilder.andWhere.mockReturnValue(queryBuilder);
  queryBuilder.orderBy.mockReturnValue(queryBuilder);
  queryBuilder.addOrderBy.mockReturnValue(queryBuilder);
  queryBuilder.take.mockReturnValue(queryBuilder);
  return queryBuilder;
}
