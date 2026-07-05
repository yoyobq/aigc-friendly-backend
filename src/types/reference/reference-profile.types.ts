// src/types/reference/reference-profile.types.ts

export const REFERENCE_PROFILE_CAPABILITY_ID = 'reference.profile' as const;

export const REFERENCE_PROFILE_OPERATIONS = {
  listByGroupKeys: 'listByGroupKeys',
} as const;

export interface ReferenceProfileListByGroupKeysInput {
  readonly groupKeys: readonly string[];
}

export interface ReferenceProfileSummary {
  readonly profileKey: string;
  readonly groupKey: string;
  readonly displayName: string;
}
