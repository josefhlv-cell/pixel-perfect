export type SdmxFetchOptions = {
  baseUrl: string;
  flowRef: string;
  key?: string;
  providerRef?: string;
  accept?: string;
  signal?: AbortSignal;
};

export async function fetchSdmxJson(options: SdmxFetchOptions): Promise<{
  retrievedAt: string;
  url: string;
  data: unknown;
}> {
  const retrievedAt = new Date().toISOString();
  const base = options.baseUrl.replace(/\/$/, "");
  const path = options.key
    ? `/rest/v1/data/${encodeURIComponent(options.flowRef)}/${encodeURIComponent(options.key)}/${encodeURIComponent(options.providerRef ?? "all")}`
    : `/rest/v1/data/${encodeURIComponent(options.flowRef)}/${encodeURIComponent(options.providerRef ?? "all")}`;
  const url = new URL(base + path);
  const response = await fetch(url, {
    signal: options.signal,
    headers: { accept: options.accept ?? "application/vnd.sdmx.data+json;version=1.0.0" },
  });
  if (!response.ok) throw new Error(`SDMX HTTP ${response.status} from ${url.hostname}`);
  return { retrievedAt, url: url.toString(), data: await response.json() };
}
