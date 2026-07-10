// src/modules/common/email-capability/email-capability.module.ts
import { Module } from '@nestjs/common';
import {
  NotificationEmailCapabilityOwnership,
  NotificationEmailQueueSendBindingDeclaration,
  NotificationEmailRuntimeManifest,
  NotificationEmailSendmailCapabilityOwnership,
} from './email-capability.providers';

@Module({
  providers: [
    NotificationEmailCapabilityOwnership,
    NotificationEmailRuntimeManifest,
    NotificationEmailQueueSendBindingDeclaration,
    NotificationEmailSendmailCapabilityOwnership,
  ],
  exports: [
    NotificationEmailCapabilityOwnership,
    NotificationEmailRuntimeManifest,
    NotificationEmailQueueSendBindingDeclaration,
    NotificationEmailSendmailCapabilityOwnership,
  ],
})
export class EmailCapabilityModule {}
