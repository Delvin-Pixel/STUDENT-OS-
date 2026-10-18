export type NexaDataApiPlatformStatus = 'enabled' | 'disabled' | 'unavailable';

export type NexaDataApiPlatformReason =
  | 'configuration_missing'
  | 'credential_rejected'
  | 'unexpected_status'
  | 'probe_failed'
  | null;

export type NexaDataApiPlatformClassification = Readonly<{
  status: NexaDataApiPlatformStatus;
  reason: NexaDataApiPlatformReason;
}>;

export function classifyNexaDataApiPlatformProbe(input: Readonly<{
  configured: boolean;
  httpStatus: number | null;
  failed: boolean;
}>): NexaDataApiPlatformClassification {
  if (!input.configured) {
    return Object.freeze({ status: 'unavailable', reason: 'configuration_missing' });
  }

  if (input.failed || input.httpStatus === null) {
    return Object.freeze({ status: 'unavailable', reason: 'probe_failed' });
  }

  if (input.httpStatus >= 200 && input.httpStatus < 300) {
    return Object.freeze({ status: 'enabled', reason: null });
  }

  if (input.httpStatus === 404 || input.httpStatus === 410) {
    return Object.freeze({ status: 'disabled', reason: null });
  }

  if (input.httpStatus === 401 || input.httpStatus === 403) {
    return Object.freeze({ status: 'unavailable', reason: 'credential_rejected' });
  }

  return Object.freeze({ status: 'unavailable', reason: 'unexpected_status' });
}
