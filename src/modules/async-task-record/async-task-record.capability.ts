import { Injectable } from '@nestjs/common';
import { CapabilityAnchorProvider } from '@src/infrastructure/capability/capability.decorators';

export const PLATFORM_ASYNC_TASK_AUDIT_CAPABILITY_ID = 'platform.async-task-audit' as const;

@Injectable()
@CapabilityAnchorProvider({
  capabilityId: PLATFORM_ASYNC_TASK_AUDIT_CAPABILITY_ID,
  mode: 'always-on',
  decisionRef: 'docs/capabilities/current.md',
})
export class AsyncTaskAuditCapabilityAnchor {}
