// src/modules/common/ai-capability/ai-capability.module.ts
import { Module } from '@nestjs/common';
import {
  AiLocalMockCapabilityOwnership,
  AiOpenAiCapabilityOwnership,
  AiQueueCapabilityOwnership,
  AiQueueRuntimeManifest,
  AiQueueEmbedBindingDeclaration,
  AiQueueGenerateBindingDeclaration,
  AiQueueWorkflowBindingDeclaration,
  AiQwenCapabilityOwnership,
} from './ai-capability.providers';

@Module({
  providers: [
    AiQueueCapabilityOwnership,
    AiQueueRuntimeManifest,
    AiQueueGenerateBindingDeclaration,
    AiQueueEmbedBindingDeclaration,
    AiQueueWorkflowBindingDeclaration,
    AiLocalMockCapabilityOwnership,
    AiOpenAiCapabilityOwnership,
    AiQwenCapabilityOwnership,
  ],
  exports: [
    AiQueueCapabilityOwnership,
    AiQueueRuntimeManifest,
    AiQueueGenerateBindingDeclaration,
    AiQueueEmbedBindingDeclaration,
    AiQueueWorkflowBindingDeclaration,
    AiLocalMockCapabilityOwnership,
    AiOpenAiCapabilityOwnership,
    AiQwenCapabilityOwnership,
  ],
})
export class AiCapabilityModule {}
