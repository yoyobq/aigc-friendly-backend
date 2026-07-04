/// <reference types="jest" />
import { AiWorkflowNonRetryableError } from '@src/usecases/ai-worker/ai-workflow-worker-errors';
import { UnrecoverableError } from 'bullmq';
import { AiJobHandler } from './ai-job.handler';
import type { AiWorkflowJob } from './ai-job.mapper';
import { AiJobProcessor } from './ai-job.processor';

type AiJobHandlerMock = {
  readonly processWorkflow: jest.Mock;
};

describe('AiJobProcessor workflow routing', () => {
  it('converts workflow non-retryable error to BullMQ UnrecoverableError', async () => {
    const handler: AiJobHandlerMock = {
      processWorkflow: jest
        .fn()
        .mockRejectedValue(
          new AiWorkflowNonRetryableError(
            'workflow_handler_not_found',
            'WORKFLOW_HANDLER_NOT_FOUND',
          ),
        ),
    };
    const processor = new AiJobProcessor(handler as unknown as AiJobHandler);

    await expect(processor.process(createWorkflowJob())).rejects.toBeInstanceOf(UnrecoverableError);
  });
});

function createWorkflowJob(): AiWorkflowJob {
  const jobLike = {
    name: 'workflow',
    id: 'job-1',
    data: {
      workflowId: 'workflow-1',
      traceId: 'trace-1',
    },
    attemptsMade: 0,
    opts: { attempts: 1 },
    timestamp: Date.parse('2026-01-01T00:00:00.000Z'),
  };
  return jobLike as unknown as AiWorkflowJob;
}
