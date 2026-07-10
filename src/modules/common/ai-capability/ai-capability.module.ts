// src/modules/common/ai-capability/ai-capability.module.ts
import { Module } from '@nestjs/common';
import {
  AiQueueCapabilityAnchor,
  AiQueueEmbedBindingDeclaration,
  AiQueueGenerateBindingDeclaration,
  AiQueueWorkflowBindingDeclaration,
} from './ai-capability.providers';

@Module({
  providers: [
    AiQueueCapabilityAnchor,
    AiQueueGenerateBindingDeclaration,
    AiQueueEmbedBindingDeclaration,
    AiQueueWorkflowBindingDeclaration,
  ],
  exports: [
    AiQueueCapabilityAnchor,
    AiQueueGenerateBindingDeclaration,
    AiQueueEmbedBindingDeclaration,
    AiQueueWorkflowBindingDeclaration,
  ],
})
export class AiCapabilityModule {}
