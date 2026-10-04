import { getNexaAiRuntimeConfig } from '@/lib/ai-runtime';
import { getStudentOsBridgeAdmissionConfig } from '@/lib/student-os-bridge-admission';
import {
  NEXA_ACADEMIC_CONTEXT_BINDING_VERSION,
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
  academicContextBindingVersion: string;
  capabilities: readonly string[];
  limits: Readonly<{
    maxBodyBytes: number;
    timeoutMs: number | null;
    globalPerMinute: number | null;
    userPerMinute: number | null;
    userPerHour: number | null;
  }>;
  configuration: Readonly<{
    bridgeSecret: 'configured' | 'missing';
    aiGateway: 'configured' | 'missing';
    runtime: 'valid' | 'invalid';
    admissionControl: 'valid' | 'invalid';
    rateLimitSecret: 'configured' | 'missing';
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

  const rateLimitSecretConfigured = String(process.env.RATE_LIMIT_SECRET ?? '').length >= 32;
  if (!rateLimitSecretConfigured) reasons.push('rate_limit_secret_missing');

  let timeoutMs: number | null = null;
  let runtimeValid = true;
  try {
    timeoutMs = getStudentOsBridgeTimeoutMs(process.env.NEXA_STUDENT_OS_BRIDGE_TIMEOUT_MS);
    getNexaAiRuntimeConfig();
  } catch {
    runtimeValid = false;
    reasons.push('runtime_configuration_invalid');
  }

  let admissionConfig: ReturnType<typeof getStudentOsBridgeAdmissionConfig> | null = null;
  let admissionControlValid = true;
  try {
    admissionConfig = getStudentOsBridgeAdmissionConfig();
  } catch {
    admissionControlValid = false;
    reasons.push('admission_control_invalid');
  }

  return Object.freeze({
    service: 'nexa',
    version: NEXA_VERSION,
    integration: 'student-os',
    status: reasons.length === 0 ? 'ready' : 'degraded',
    checkedAt: new Date().toISOString(),
    providerContractVersion: NEXA_PROVIDER_CONTRACT_VERSION,
    academicDecisionAuthority: NEXA_STUDENT_OS_ACADEMIC_AUTHORITY,
    academicContextBindingVersion: NEXA_ACADEMIC_CONTEXT_BINDING_VERSION,
    capabilities: NEXA_PROVIDER_CAPABILITIES,
    limits: Object.freeze({
      maxBodyBytes: STUDENT_OS_BRIDGE_MAX_BODY_BYTES,
      timeoutMs,
      globalPerMinute: admissionConfig?.globalPerMinute ?? null,
      userPerMinute: admissionConfig?.userPerMinute ?? null,
      userPerHour: admissionConfig?.userPerHour ?? null,
    }),
    configuration: Object.freeze({
      bridgeSecret: bridgeSecretConfigured ? 'configured' : 'missing',
      aiGateway: aiGatewayConfigured ? 'configured' : 'missing',
      runtime: runtimeValid ? 'valid' : 'invalid',
      admissionControl: admissionControlValid ? 'valid' : 'invalid',
      rateLimitSecret: rateLimitSecretConfigured ? 'configured' : 'missing',
    }),
    reasons: Object.freeze(reasons),
  });
}
