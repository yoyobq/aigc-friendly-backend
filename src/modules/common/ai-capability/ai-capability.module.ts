// src/modules/common/ai-capability/ai-capability.module.ts
import { Module } from '@nestjs/common';
import {
  AiLocalMockCapabilityDeclaration,
  AiOpenAiCapabilityDeclaration,
  AiQueueCapabilityDeclaration,
  AiQueueEmbedBindingDeclaration,
  AiQueueGenerateBindingDeclaration,
  AiQueueWorkflowBindingDeclaration,
  AiQwenCapabilityDeclaration,
} from './ai-capability.providers';

@Module({
  providers: [
    AiQueueCapabilityDeclaration,
    AiQueueGenerateBindingDeclaration,
    AiQueueEmbedBindingDeclaration,
    AiQueueWorkflowBindingDeclaration,
    AiLocalMockCapabilityDeclaration,
    AiOpenAiCapabilityDeclaration,
    AiQwenCapabilityDeclaration,
  ],
  exports: [
    AiQueueCapabilityDeclaration,
    AiQueueGenerateBindingDeclaration,
    AiQueueEmbedBindingDeclaration,
    AiQueueWorkflowBindingDeclaration,
    AiLocalMockCapabilityDeclaration,
    AiOpenAiCapabilityDeclaration,
    AiQwenCapabilityDeclaration,
  ],
})
export class AiCapabilityModule {}
