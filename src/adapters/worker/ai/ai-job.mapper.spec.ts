/// <reference types="jest" />
import {
  type AiWorkflowJob,
  mapAiWorkflowJobToFailInput,
  mapAiWorkflowJobToProcessInput,
} from './ai-job.mapper';

describe('AI workflow job mapper', () => {
  it('maps workflow job payload to process input using explicit workflow and trace ids', () => {
    const input = mapAiWorkflowJobToProcessInput({
      job: createWorkflowJob({
        id: 'job-1',
        data: {
          workflowId: 'workflow-1',
          traceId: 'trace-1',
        },
      }),
    });

    expect(input).toMatchObject({
      queueName: 'ai',
      jobName: 'workflow',
      jobId: 'job-1',
      workflowId: 'workflow-1',
      traceId: 'trace-1',
      attemptsMade: 1,
      maxAttempts: 3,
      enqueuedAt: new Date('2026-01-01T00:00:00.000Z'),
      startedAt: new Date('2026-01-01T00:00:01.000Z'),
    });
  });

  it('throws on missing workflow id in strict process mapping', () => {
    expect(() =>
      mapAiWorkflowJobToProcessInput({
        job: createWorkflowJob({
          data: {
            traceId: 'trace-1',
          },
        }),
      }),
    ).toThrow('missing_payload_workflow_id:workflow');
  });

  it('uses degraded workflow and trace ids only for failed event mapping', () => {
    const input = mapAiWorkflowJobToFailInput({
      job: createWorkflowJob({
        id: 'job-2',
        data: {},
        finishedOn: Date.parse('2026-01-01T00:00:05.000Z'),
      }),
      error: new Error('worker_failed:boom'),
    });

    expect(input).toMatchObject({
      workflowId: 'degraded-workflow:workflow:job-2',
      traceId: 'degraded-trace:workflow:job-2',
      reason: 'worker_failed:boom',
      occurredAt: new Date('2026-01-01T00:00:05.000Z'),
    });
  });
});

function createWorkflowJob(
  overrides: {
    readonly id?: string;
    readonly data?: Record<string, unknown>;
    readonly attemptsMade?: number;
    readonly finishedOn?: number;
  } = {},
): AiWorkflowJob {
  const jobLike = {
    name: 'workflow',
    id: overrides.id ?? 'job-1',
    data: overrides.data ?? {
      workflowId: 'workflow-1',
      traceId: 'trace-1',
    },
    attemptsMade: overrides.attemptsMade ?? 1,
    opts: { attempts: 3 },
    timestamp: Date.parse('2026-01-01T00:00:00.000Z'),
    processedOn: Date.parse('2026-01-01T00:00:01.000Z'),
    finishedOn: overrides.finishedOn,
  };
  return jobLike as unknown as AiWorkflowJob;
}
