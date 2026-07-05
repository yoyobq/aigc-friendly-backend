import type {
  CapabilityCommand,
  CapabilityQuery,
  CapabilityResult,
} from '@app-types/common/capability.types';
import {
  REFERENCE_PROFILE_CAPABILITY_ID,
  REFERENCE_PROFILE_OPERATIONS,
  type ReferenceProfileListByGroupKeysInput,
  type ReferenceProfileSummary,
} from '@app-types/reference/reference-profile.types';
import { Injectable } from '@nestjs/common';
import { CapabilityOperationHandlerProvider } from '@src/infrastructure/capability/capability.decorators';
import type { CapabilityOperationHandler } from '@src/usecases/common/ports/capability-bus.contract';
import { normalizeReferenceGroupKeysInput } from './reference.input.normalize';

const REFERENCE_PROFILES: readonly ReferenceProfileSummary[] = [
  { profileKey: 'profile-alpha-1', groupKey: 'alpha', displayName: 'Alpha One' },
  { profileKey: 'profile-alpha-2', groupKey: 'alpha', displayName: 'Alpha Two' },
  { profileKey: 'profile-beta-1', groupKey: 'beta', displayName: 'Beta One' },
];

@Injectable()
@CapabilityOperationHandlerProvider({
  capabilityId: REFERENCE_PROFILE_CAPABILITY_ID,
  operation: REFERENCE_PROFILE_OPERATIONS.listByGroupKeys,
  operationKind: 'query',
})
export class ReferenceProfileListByGroupKeysHandler implements CapabilityOperationHandler<
  ReferenceProfileListByGroupKeysInput,
  readonly ReferenceProfileSummary[]
> {
  readonly capability = REFERENCE_PROFILE_CAPABILITY_ID;
  readonly operation = REFERENCE_PROFILE_OPERATIONS.listByGroupKeys;
  readonly operationKind = 'query' as const;

  handle(
    envelope:
      | CapabilityCommand<ReferenceProfileListByGroupKeysInput>
      | CapabilityQuery<ReferenceProfileListByGroupKeysInput>,
  ): Promise<CapabilityResult<readonly ReferenceProfileSummary[]>> {
    const requestedGroupKeys = normalizeReferenceGroupKeysInput(envelope.payload.groupKeys);
    const profiles = REFERENCE_PROFILES.filter((profile) =>
      requestedGroupKeys.includes(profile.groupKey),
    );
    return Promise.resolve({ ok: true, value: profiles });
  }
}
