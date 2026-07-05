// src/modules/common/email-capability/email-capability.providers.ts
import { Injectable } from '@nestjs/common';
import { BULLMQ_JOBS, BULLMQ_QUEUES } from '@src/infrastructure/bullmq/bullmq.constants';
import {
  CapabilityManifestProvider,
  CapabilityQueueBindingProvider,
} from '@src/infrastructure/capability/capability.decorators';
import {
  EMAIL_DELIVERY_PROVIDER_KIND,
  EMAIL_SENDMAIL_PROVIDER_NAME,
  NOTIFICATION_EMAIL_CAPABILITY_ID,
  NOTIFICATION_EMAIL_SENDMAIL_CAPABILITY_ID,
} from './email-capability.constants';

@Injectable()
@CapabilityManifestProvider({
  id: NOTIFICATION_EMAIL_CAPABILITY_ID,
  kind: 'technical',
  version: '0.1.0',
  processes: ['api', 'worker'],
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
export class NotificationEmailCapabilityDeclaration {}

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

@Injectable()
@CapabilityManifestProvider({
  id: NOTIFICATION_EMAIL_SENDMAIL_CAPABILITY_ID,
  kind: 'technical',
  version: '0.1.0',
  processes: ['worker'],
  dependsOn: [{ capabilityId: NOTIFICATION_EMAIL_CAPABILITY_ID, mode: 'required' }],
  runtime: { healthCheck: true },
  contributions: {
    providers: [
      {
        providerKind: EMAIL_DELIVERY_PROVIDER_KIND,
        providerName: EMAIL_SENDMAIL_PROVIDER_NAME,
      },
    ],
  },
})
export class NotificationEmailSendmailCapabilityDeclaration {}
