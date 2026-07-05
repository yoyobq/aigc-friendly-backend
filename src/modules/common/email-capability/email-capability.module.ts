// src/modules/common/email-capability/email-capability.module.ts
import { Module } from '@nestjs/common';
import {
  NotificationEmailCapabilityDeclaration,
  NotificationEmailQueueSendBindingDeclaration,
  NotificationEmailSendmailCapabilityDeclaration,
} from './email-capability.providers';

@Module({
  providers: [
    NotificationEmailCapabilityDeclaration,
    NotificationEmailQueueSendBindingDeclaration,
    NotificationEmailSendmailCapabilityDeclaration,
  ],
  exports: [
    NotificationEmailCapabilityDeclaration,
    NotificationEmailQueueSendBindingDeclaration,
    NotificationEmailSendmailCapabilityDeclaration,
  ],
})
export class EmailCapabilityModule {}
