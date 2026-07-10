// src/modules/common/email-capability/email-capability.module.ts
import { Module } from '@nestjs/common';
import {
  NotificationEmailCapabilityAnchor,
  NotificationEmailQueueSendBindingDeclaration,
} from './email-capability.providers';

@Module({
  providers: [NotificationEmailCapabilityAnchor, NotificationEmailQueueSendBindingDeclaration],
  exports: [NotificationEmailCapabilityAnchor, NotificationEmailQueueSendBindingDeclaration],
})
export class EmailCapabilityModule {}
