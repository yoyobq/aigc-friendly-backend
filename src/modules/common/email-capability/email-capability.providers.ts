// src/modules/common/email-capability/email-capability.providers.ts
import { Injectable } from '@nestjs/common';
import { BULLMQ_JOBS, BULLMQ_QUEUES } from '@src/infrastructure/bullmq/bullmq.constants';
import {
  CapabilityAnchorProvider,
  CapabilityQueueBindingProvider,
  CapabilityRuntimeContributionProvider,
} from '@src/infrastructure/capability/capability.decorators';
import { NOTIFICATION_EMAIL_CAPABILITY_ID } from './email-capability.constants';

@Injectable()
@CapabilityAnchorProvider({
  capabilityId: NOTIFICATION_EMAIL_CAPABILITY_ID,
  mode: 'switchable',
  decisionRef: 'docs/capabilities/current.md',
})
@CapabilityRuntimeContributionProvider({
  capabilityId: NOTIFICATION_EMAIL_CAPABILITY_ID,
  contributions: {
    queues: [
      {
        operation: 'send',
        operationKind: 'command',
        queueName: BULLMQ_QUEUES.EMAIL,
        jobName: BULLMQ_JOBS.EMAIL.SEND,
        dedupKeyMapping: 'jobId',
      },
    ],
  },
})
export class NotificationEmailCapabilityAnchor {}

@Injectable()
@CapabilityQueueBindingProvider({
  capabilityId: NOTIFICATION_EMAIL_CAPABILITY_ID,
  operation: 'send',
  operationKind: 'command',
  queueName: BULLMQ_QUEUES.EMAIL,
  jobName: BULLMQ_JOBS.EMAIL.SEND,
  dedupKeyMapping: 'jobId',
})
export class NotificationEmailQueueSendBindingDeclaration {}
