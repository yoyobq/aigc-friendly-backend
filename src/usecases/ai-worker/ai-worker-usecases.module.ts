// src/usecases/ai-worker/ai-worker-usecases.module.ts
import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { AiProviderCallRecordModule } from '@src/modules/ai-provider-call-record/ai-provider-call-record.module';
import { AiWorkflowContextModule } from '@src/modules/ai-workflow-context/ai-workflow-context.module';
import { AsyncTaskRecordModule } from '@src/modules/async-task-record/async-task-record.module';
import { AiWorkerModule } from '@src/modules/common/ai-worker/ai-worker.module';
import { AiWorkflowHandlerRegistry } from './ai-workflow-handler.registry';
import { ConsumeAiEmbedJobUsecase, ConsumeAiGenerateJobUsecase } from './consume-ai-job.usecase';
import { ConsumeAiWorkflowJobUsecase } from './consume-ai-workflow-job.usecase';

@Module({
  imports: [
    DiscoveryModule,
    AiWorkerModule,
    AsyncTaskRecordModule,
    AiProviderCallRecordModule,
    AiWorkflowContextModule,
  ],
  providers: [
    ConsumeAiGenerateJobUsecase,
    ConsumeAiEmbedJobUsecase,
    ConsumeAiWorkflowJobUsecase,
    AiWorkflowHandlerRegistry,
  ],
  exports: [
    ConsumeAiGenerateJobUsecase,
    ConsumeAiEmbedJobUsecase,
    ConsumeAiWorkflowJobUsecase,
    AiWorkflowHandlerRegistry,
  ],
})
export class AiWorkerUsecasesModule {}
