import type { CapabilityResult } from '@app-types/common/capability.types';
import {
  REFERENCE_PROFILE_CAPABILITY_ID,
  REFERENCE_PROFILE_OPERATIONS,
  type ReferenceProfileListByGroupKeysInput,
  type ReferenceProfileSummary,
} from '@app-types/reference/reference-profile.types';
import { Inject, Injectable } from '@nestjs/common';
import {
  CAPABILITY_QUERY_BUS,
  type CapabilityQueryBus,
} from '@src/usecases/common/ports/capability-bus.contract';
import type { ReferenceProfileClient } from '@src/usecases/common/ports/reference-profile-client.contract';

@Injectable()
export class DispatcherReferenceProfileClient implements ReferenceProfileClient {
  constructor(
    @Inject(CAPABILITY_QUERY_BUS)
    private readonly queryBus: CapabilityQueryBus,
  ) {}

  async listByGroupKeys(
    input: ReferenceProfileListByGroupKeysInput,
  ): Promise<CapabilityResult<readonly ReferenceProfileSummary[]>> {
    return await this.queryBus.ask<
      ReferenceProfileListByGroupKeysInput,
      readonly ReferenceProfileSummary[]
    >({
      capability: REFERENCE_PROFILE_CAPABILITY_ID,
      operation: REFERENCE_PROFILE_OPERATIONS.listByGroupKeys,
      payload: input,
    });
  }
}
