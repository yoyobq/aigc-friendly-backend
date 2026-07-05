import type { CapabilityResult } from '@app-types/common/capability.types';
import type {
  ReferenceProfileListByGroupKeysInput,
  ReferenceProfileSummary,
} from '@app-types/reference/reference-profile.types';

export const REFERENCE_PROFILE_CLIENT = Symbol('REFERENCE_PROFILE_CLIENT');

export interface ReferenceProfileClient {
  listByGroupKeys(
    input: ReferenceProfileListByGroupKeysInput,
  ): Promise<CapabilityResult<readonly ReferenceProfileSummary[]>>;
}
