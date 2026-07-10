// src/modules/common/email-capability/email-capability.providers.ts
import { Injectable } from '@nestjs/common';
import { BULLMQ_JOBS, BULLMQ_QUEUES } from '@src/infrastructure/bullmq/bullmq.constants';
import {
  CapabilityOwnershipProvider,
  CapabilityQueueBindingProvider,
  CapabilityRuntimeManifestProvider,
} from '@src/infrastructure/capability/capability.decorators';
import {
  NOTIFICATION_EMAIL_CAPABILITY_ID,
  NOTIFICATION_EMAIL_SENDMAIL_CAPABILITY_ID,
} from './email-capability.constants';

@Injectable()
@CapabilityOwnershipProvider({
  capabilityId: NOTIFICATION_EMAIL_CAPABILITY_ID,
  kind: 'technical',
  semanticScope: 'Email queue admission, delivery execution, and delivery lifecycle.',
  owns: ['Email enqueue, delivery and worker execution lifecycle.'],
  nonGoals: ['Email verification business outcomes.'],
  physicalScopes: [
    { path: 'src/modules/common/email-queue', role: 'primary' },
    { path: 'src/usecases/email-queue', role: 'primary' },
    { path: 'src/usecases/email-worker', role: 'primary' },
    { path: 'src/adapters/api/graphql/email', role: 'primary' },
    {
      path: 'src/modules/common/email-capability',
      role: 'shared-implementation',
      reason: 'Shared ownership and runtime declaration assembly for email capabilities.',
    },
  ],
  publicSurfaces: [
    { status: 'present', path: 'src/modules/common/email-queue/email-queue.types.ts' },
  ],
  allowedDependencies: ['platform.async-task-audit'],
  foundationClassification: 'shared-technical-foundation',
  validationEntrypoints: ['test/08-qm-worker/email-queue-consume.e2e-spec.ts'],
})
export class NotificationEmailCapabilityOwnership {}

@Injectable()
@CapabilityRuntimeManifestProvider({
  capabilityId: NOTIFICATION_EMAIL_CAPABILITY_ID,
  version: '0.1.0',
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
export class NotificationEmailRuntimeManifest {}

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
@CapabilityOwnershipProvider({
  capabilityId: NOTIFICATION_EMAIL_SENDMAIL_CAPABILITY_ID,
  kind: 'technical',
  semanticScope: 'Sendmail provider configuration, binding, and health reporting.',
  owns: ['Sendmail provider binding, configuration and health lifecycle.'],
  nonGoals: ['Email queue and notification semantics.'],
  physicalScopes: [
    {
      path: 'src/modules/common/email-worker/email-sendmail.capability.ts',
      role: 'primary',
    },
    {
      path: 'src/modules/common/email-capability',
      role: 'shared-implementation',
      reason: 'Shared ownership declaration assembly for email capabilities.',
    },
  ],
  publicSurfaces: [
    {
      status: 'not-required',
      reason: 'Email delivery selects the provider through the delivery binding.',
    },
  ],
  allowedDependencies: [NOTIFICATION_EMAIL_CAPABILITY_ID],
  foundationClassification: 'shared-technical-foundation',
  validationEntrypoints: ['test/08-qm-worker/email-queue-consume.e2e-spec.ts'],
})
export class NotificationEmailSendmailCapabilityOwnership {}
