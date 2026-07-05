import { normalizeTextList } from '@core/common/input-normalize/input-normalize.policy';

const REFERENCE_GROUP_KEYS_POLICY = {
  filter_empty: true,
  reject_invalid_item: true,
  dedupe: true,
  empty_result: 'keep',
} as const;

export function normalizeReferenceGroupKeysInput(input: unknown): readonly string[] {
  const normalized = normalizeTextList(input, REFERENCE_GROUP_KEYS_POLICY, {
    fieldName: 'reference group keys',
  });
  return normalized ?? [];
}
