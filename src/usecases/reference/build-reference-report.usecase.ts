import type { CapabilityResult } from '@app-types/common/capability.types';
import type { ReferenceProfileSummary } from '@app-types/reference/reference-profile.types';
import type {
  ReferenceReportItem,
  ReferenceReportView,
} from '@app-types/reference/reference-report.types';
import { Inject, Injectable } from '@nestjs/common';
import {
  REFERENCE_PROFILE_CLIENT,
  type ReferenceProfileClient,
} from '@src/usecases/common/ports/reference-profile-client.contract';
import { normalizeReferenceGroupKeysInput } from './reference.input.normalize';

@Injectable()
export class BuildReferenceReportUsecase {
  constructor(
    @Inject(REFERENCE_PROFILE_CLIENT)
    private readonly referenceProfileClient: ReferenceProfileClient,
  ) {}

  async execute(input: {
    readonly groupKeys: readonly string[];
  }): Promise<CapabilityResult<ReferenceReportView>> {
    const groupKeys = normalizeReferenceGroupKeysInput(input.groupKeys);
    const profileResult = await this.referenceProfileClient.listByGroupKeys({
      groupKeys,
    });
    if (!profileResult.ok) {
      return { ok: false, error: profileResult.error };
    }

    const items = groupKeys.map((groupKey) =>
      buildReportItem({ groupKey, profiles: profileResult.value }),
    );
    return {
      ok: true,
      value: {
        groupCount: items.length,
        totalProfiles: profileResult.value.length,
        items,
      },
    };
  }
}

function buildReportItem(input: {
  readonly groupKey: string;
  readonly profiles: readonly ReferenceProfileSummary[];
}): ReferenceReportItem {
  const profiles = input.profiles.filter((profile) => profile.groupKey === input.groupKey);
  return {
    groupKey: input.groupKey,
    profileCount: profiles.length,
    profileNames: profiles.map((profile) => profile.displayName),
  };
}
