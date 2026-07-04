// src/adapters/worker/ai/ai-job.handler.ts
import { Injectable } from '@nestjs/common';
import {
  ConsumeAiEmbedJobUsecase,
  ConsumeAiGenerateJobUsecase,
} from '@src/usecases/ai-worker/consume-ai-job.usecase';
import { ConsumeAiWorkflowJobUsecase } from '@src/usecases/ai-worker/consume-ai-workflow-job.usecase';
import {
  AI_EMBED_JOB_NAME,
  AI_GENERATE_JOB_NAME,
  AI_WORKFLOW_JOB_NAME,
  type AiEmbedJob,
  type AiEmbedResult,
  type AiFailedJob,
  type AiGenerateJob,
  type AiGenerateResult,
  type AiWorkflowJob,
  type AiWorkflowResult,
  mapAiEmbedJobToCompleteInput,
  mapAiEmbedJobToFailInput,
  mapAiEmbedJobToProcessInput,
  mapAiGenerateJobToCompleteInput,
  mapAiGenerateJobToFailInput,
  mapAiGenerateJobToProcessInput,
  mapAiWorkflowJobToCompleteInput,
  mapAiWorkflowJobToFailInput,
  mapAiWorkflowJobToProcessInput,
  mapMissingAiJobToFailInput,
  mapUnknownAiJobToFailInput,
} from './ai-job.mapper';

@Injectable()
export class AiJobHandler {
  constructor(
    private readonly consumeAiGenerateJobUsecase: ConsumeAiGenerateJobUsecase,
    private readonly consumeAiEmbedJobUsecase: ConsumeAiEmbedJobUsecase,
    private readonly consumeAiWorkflowJobUsecase: ConsumeAiWorkflowJobUsecase,
  ) {}

  async processGenerate(input: { readonly job: AiGenerateJob }): Promise<AiGenerateResult> {
    return await this.consumeAiGenerateJobUsecase.process(
      mapAiGenerateJobToProcessInput({ job: input.job }),
    );
  }

  async processEmbed(input: { readonly job: AiEmbedJob }): Promise<AiEmbedResult> {
    return await this.consumeAiEmbedJobUsecase.process(
      mapAiEmbedJobToProcessInput({ job: input.job }),
    );
  }

  async processWorkflow(input: { readonly job: AiWorkflowJob }): Promise<AiWorkflowResult> {
    return await this.consumeAiWorkflowJobUsecase.process(
      mapAiWorkflowJobToProcessInput({ job: input.job }),
    );
  }

  async onGenerateCompleted(input: { readonly job: AiGenerateJob }): Promise<void> {
    await this.consumeAiGenerateJobUsecase.complete(
      mapAiGenerateJobToCompleteInput({ job: input.job }),
    );
  }

  async onEmbedCompleted(input: { readonly job: AiEmbedJob }): Promise<void> {
    await this.consumeAiEmbedJobUsecase.complete(mapAiEmbedJobToCompleteInput({ job: input.job }));
  }

  async onWorkflowCompleted(input: { readonly job: AiWorkflowJob }): Promise<void> {
    await this.consumeAiWorkflowJobUsecase.complete(
      mapAiWorkflowJobToCompleteInput({ job: input.job }),
    );
  }

  async onGenerateFailed(input: {
    readonly job: AiGenerateJob;
    readonly error: Error;
  }): Promise<void> {
    await this.consumeAiGenerateJobUsecase.fail(
      mapAiGenerateJobToFailInput({ job: input.job, error: input.error }),
    );
  }

  async onEmbedFailed(input: { readonly job: AiEmbedJob; readonly error: Error }): Promise<void> {
    await this.consumeAiEmbedJobUsecase.fail(
      mapAiEmbedJobToFailInput({ job: input.job, error: input.error }),
    );
  }

  async onWorkflowFailed(input: {
    readonly job: AiWorkflowJob;
    readonly error: Error;
  }): Promise<void> {
    await this.consumeAiWorkflowJobUsecase.fail(
      mapAiWorkflowJobToFailInput({ job: input.job, error: input.error }),
    );
  }

  async onFailed(input: {
    readonly job: AiFailedJob | undefined;
    readonly error: Error;
  }): Promise<void> {
    if (!input.job) {
      await this.consumeAiGenerateJobUsecase.fail(
        mapMissingAiJobToFailInput({ error: input.error }),
      );
      return;
    }
    if (input.job.name === AI_GENERATE_JOB_NAME) {
      await this.onGenerateFailed({
        job: input.job as unknown as AiGenerateJob,
        error: input.error,
      });
      return;
    }
    if (input.job.name === AI_EMBED_JOB_NAME) {
      await this.onEmbedFailed({
        job: input.job as unknown as AiEmbedJob,
        error: input.error,
      });
      return;
    }
    if (input.job.name === AI_WORKFLOW_JOB_NAME) {
      await this.onWorkflowFailed({
        job: input.job as unknown as AiWorkflowJob,
        error: input.error,
      });
      return;
    }
    await this.consumeAiGenerateJobUsecase.fail(
      mapUnknownAiJobToFailInput({ job: input.job, error: input.error }),
    );
  }
}
