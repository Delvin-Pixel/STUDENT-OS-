/** Provider-neutral HTTP data API adapter used by optional integrations. */
import { ENV } from "./env";

export type DataApiCallOptions = {
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  pathParams?: Record<string, unknown>;
  formData?: Record<string, unknown>;
};

export async function callDataApi(
  apiId: string,
  options: DataApiCallOptions = {}
): Promise<unknown> {
  if (!ENV.dataApiBaseUrl)
    throw new Error("DATA_API_BASE_URL is not configured");
  if (!ENV.dataApiKey) throw new Error("DATA_API_KEY is not configured");

  const endpoint = new URL(
    apiId.replace(/^\/+/, ""),
    ENV.dataApiBaseUrl.endsWith("/")
      ? ENV.dataApiBaseUrl
      : `${ENV.dataApiBaseUrl}/`
  );
  const query = options.query ?? {};
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null)
      endpoint.searchParams.set(key, String(value));
  }

  const response = await fetch(endpoint, {
    method: options.formData ? "POST" : options.body ? "POST" : "GET",
    headers: {
      accept: "application/json",
      ...(options.body || options.formData
        ? { "content-type": "application/json" }
        : {}),
      authorization: `Bearer ${ENV.dataApiKey}`,
    },
    ...(options.body || options.formData
      ? {
          body: JSON.stringify({
            body: options.body,
            pathParams: options.pathParams,
            formData: options.formData,
          }),
        }
      : {}),
  });

  if (!response.ok)
    throw new Error(
      `Data API request failed (${response.status} ${response.statusText})`
    );
  return response.json();
}
