import { Module } from '@nestjs/common';
import { AiWorkflowContextModule } from '@src/modules/ai-workflow-context/ai-workflow-context.module';
import { AsyncTaskRecordModule } from '@src/modules/async-task-record/async-task-record.module';
import { AiQueueModule } from '@src/modules/common/ai-queue/ai-queue.module';
import { CreateAndAdmitAiWorkflowUsecase } from './create-and-admit-ai-workflow.usecase';
import { RunAiWorkflowHousekeepingUsecase } from './run-ai-workflow-housekeeping.usecase';

@Module({
  imports: [AiWorkflowContextModule, AiQueueModule, AsyncTaskRecordModule],
  providers: [CreateAndAdmitAiWorkflowUsecase, RunAiWorkflowHousekeepingUsecase],
  exports: [CreateAndAdmitAiWorkflowUsecase, RunAiWorkflowHousekeepingUsecase],
})
export class AiWorkflowUsecasesModule {}
