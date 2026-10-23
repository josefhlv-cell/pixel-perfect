/** Apply the production-only policy before data leaves its read boundary. */
export function onlyLive<T>(query: { eq: (column: "is_sample", value: false) => T }): T {
  return query.eq("is_sample", false);
}

/** Missing observations are not zero-valued observations. */
export function observedMean(values: readonly (number | null)[]): number | null {
  const valid = values.filter((value): value is number => value != null && Number.isFinite(value));
  return valid.length
    ? Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length)
    : null;
}
