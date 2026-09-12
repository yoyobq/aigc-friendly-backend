/** Compare an audience against the configured comma-separated value passed by the caller. */
export function isAllowedAudience(audience: string, configAudience: string): boolean {
  if (!audience || !configAudience) return false;
  return configAudience
    .split(',')
    .map((value) => value.trim())
    .includes(audience);
}
