import { getNexaAiRuntimeConfig } from '@/lib/ai-runtime';
import {
  NEXA_PROVIDER_CAPABILITIES,
  NEXA_PROVIDER_CONTRACT_VERSION,
  NEXA_STUDENT_OS_ACADEMIC_AUTHORITY,
} from '@/lib/nexa-provider';
import {
  STUDENT_OS_BRIDGE_MAX_BODY_BYTES,
  getStudentOsBridgeTimeoutMs,
  isConfiguredStudentOsBridgeSecret,
} from '@/lib/student-os-bridge-core';
import { NEXA_VERSION } from '@/lib/version';

export type StudentOsBridgeReadinessStatus = 'ready' | 'degraded';

export type StudentOsBridgeReadiness = Readonly<{
  service: 'nexa';
  version: string;
  integration: 'student-os';
  status: StudentOsBridgeReadinessStatus;
  checkedAt: string;
  providerContractVersion: string;
  academicDecisionAuthority: string;
  capabilities: readonly string[];
  limits: Readonly<{
    maxBodyBytes: number;
    timeoutMs: number | null;
  }>;
  configuration: Readonly<{
    bridgeSecret: 'configured' | 'missing';
    aiGateway: 'configured' | 'missing';
    runtime: 'valid' | 'invalid';
  }>;
  reasons: readonly string[];
}>;

export function getStudentOsBridgeReadiness(): StudentOsBridgeReadiness {
  const reasons: string[] = [];
  const bridgeSecretConfigured = isConfiguredStudentOsBridgeSecret(
    process.env.NEXA_STUDENT_OS_BRIDGE_SECRET,
  );
  if (!bridgeSecretConfigured) reasons.push('bridge_secret_missing');

  const aiGatewayConfigured = Boolean(String(process.env.AI_GATEWAY_API_KEY ?? '').trim());
  if (!aiGatewayConfigured) reasons.push('ai_gateway_missing');

  let timeoutMs: number | null = null;
  let runtimeValid = true;
  try {
    timeoutMs = getStudentOsBridgeTimeoutMs(process.env.NEXA_STUDENT_OS_BRIDGE_TIMEOUT_MS);
    getNexaAiRuntimeConfig();
  } catch {
    runtimeValid = false;
    reasons.push('runtime_configuration_invalid');
  }

  return Object.freeze({
    service: 'nexa',
    version: NEXA_VERSION,
    integration: 'student-os',
    status: reasons.length === 0 ? 'ready' : 'degraded',
    checkedAt: new Date().toISOString(),
    providerContractVersion: NEXA_PROVIDER_CONTRACT_VERSION,
    academicDecisionAuthority: NEXA_STUDENT_OS_ACADEMIC_AUTHORITY,
    capabilities: NEXA_PROVIDER_CAPABILITIES,
    limits: Object.freeze({
      maxBodyBytes: STUDENT_OS_BRIDGE_MAX_BODY_BYTES,
      timeoutMs,
    }),
    configuration: Object.freeze({
      bridgeSecret: bridgeSecretConfigured ? 'configured' : 'missing',
      aiGateway: aiGatewayConfigured ? 'configured' : 'missing',
      runtime: runtimeValid ? 'valid' : 'invalid',
    }),
    reasons: Object.freeze(reasons),
  });
}
