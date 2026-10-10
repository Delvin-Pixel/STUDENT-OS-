import { getNexaAiGatewayReadiness, type NexaAiGatewayReadiness } from '@/lib/ai-gateway-readiness';
import { getNexaAiRuntimeConfig } from '@/lib/ai-runtime';
import { getStudentOsBridgeAdmissionConfig } from '@/lib/student-os-bridge-admission';
import {
  STUDENT_OS_BRIDGE_FALLBACK_MODE,
  createStudentOsBridgeFallbackDirective,
  type StudentOsBridgeFallbackDirective,
} from '@/lib/student-os-bridge-fallback-core';
import { classifyStudentOsBridgeOperationalAdmission } from '@/lib/student-os-bridge-operational-admission-core';
import {
  NEXA_ACADEMIC_CONTEXT_BINDING_VERSION,
  NEXA_PROVIDER_CAPABILITIES,
  NEXA_PROVIDER_CONTRACT_VERSION,
  NEXA_STUDENT_OS_ACADEMIC_AUTHORITY,
} from '@/lib/nexa-provider';
import {
  STUDENT_OS_BRIDGE_CONTRACT_VERSION,
  STUDENT_OS_BRIDGE_SUPPORTED_CONTRACT_VERSIONS,
  STUDENT_OS_BRIDGE_MAX_BODY_BYTES,
  getStudentOsBridgeTimeoutMs,
  isConfiguredStudentOsBridgeSecret,
  parseStudentOsBridgeNegotiationRequired,
} from '@/lib/student-os-bridge-core';
import { NEXA_VERSION } from '@/lib/version';

export type StudentOsBridgeReadinessStatus = 'ready' | 'degraded';
export type StudentOsBridgeServingMode = 'nexa' | typeof STUDENT_OS_BRIDGE_FALLBACK_MODE | 'unavailable';

export type StudentOsBridgeReadiness = Readonly<{
  service: 'nexa';
  version: string;
  integration: 'student-os';
  status: StudentOsBridgeReadinessStatus;
  checkedAt: string;
  providerContractVersion: string;
  bridgeContractVersion: string;
  supportedBridgeContractVersions: readonly string[];
  bridgeContractNegotiationRequired: boolean | null;
  legacyBridgeContractDefaultAllowed: boolean;
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
    contractNegotiationPolicy: 'valid' | 'invalid';
  }>;
  reasons: readonly string[];
}>;

export type StudentOsBridgeOperationalReadiness = StudentOsBridgeReadiness & Readonly<{
  servingMode: StudentOsBridgeServingMode;
  fallback: StudentOsBridgeFallbackDirective | null;
  aiGatewayOperational: Readonly<{
    status: NexaAiGatewayReadiness['status'];
    reason: NexaAiGatewayReadiness['reason'];
    credits: NexaAiGatewayReadiness['credits'];
    model: string | null;
    modelAvailable: boolean;
    providerCount: number;
  }>;
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

  let bridgeContractNegotiationRequired: boolean | null = null;
  let contractNegotiationPolicyValid = true;
  try {
    bridgeContractNegotiationRequired = parseStudentOsBridgeNegotiationRequired(
      process.env.NEXA_STUDENT_OS_BRIDGE_NEGOTIATION_REQUIRED,
    );
  } catch {
    contractNegotiationPolicyValid = false;
    reasons.push('contract_negotiation_policy_invalid');
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
    bridgeContractVersion: STUDENT_OS_BRIDGE_CONTRACT_VERSION,
    supportedBridgeContractVersions: STUDENT_OS_BRIDGE_SUPPORTED_CONTRACT_VERSIONS,
    bridgeContractNegotiationRequired,
    legacyBridgeContractDefaultAllowed: bridgeContractNegotiationRequired === false,
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
      contractNegotiationPolicy: contractNegotiationPolicyValid ? 'valid' : 'invalid',
    }),
    reasons: Object.freeze(reasons),
  });
}

export async function getStudentOsBridgeOperationalReadiness(): Promise<StudentOsBridgeOperationalReadiness> {
  const base = getStudentOsBridgeReadiness();
  const gateway = await getNexaAiGatewayReadiness();
  const reasons = [...base.reasons];

  if (gateway.status !== 'operational') {
    const reason = gateway.reason ?? 'ai_gateway_status_unavailable';
    if (!reasons.includes(reason)) reasons.push(reason);
  }

  const operationalAdmission = classifyStudentOsBridgeOperationalAdmission({
    status: gateway.status,
    reason: gateway.reason,
  });

  const fallback = (
    !operationalAdmission.allowed
    && base.configuration.bridgeSecret === 'configured'
  )
    ? createStudentOsBridgeFallbackDirective({
        reason: operationalAdmission.reason,
        retryable: operationalAdmission.retryable,
        retryAfterSeconds: operationalAdmission.retryAfterSeconds,
      })
    : null;

  const servingMode: StudentOsBridgeServingMode = (
    base.status === 'ready' && operationalAdmission.allowed
  )
    ? 'nexa'
    : fallback
      ? STUDENT_OS_BRIDGE_FALLBACK_MODE
      : 'unavailable';

  return Object.freeze({
    ...base,
    status: reasons.length === 0 ? 'ready' : 'degraded',
    checkedAt: new Date().toISOString(),
    servingMode,
    fallback,
    aiGatewayOperational: Object.freeze({
      status: gateway.status,
      reason: gateway.reason,
      credits: gateway.credits,
      model: gateway.model,
      modelAvailable: gateway.modelAvailable,
      providerCount: gateway.providerCount,
    }),
    reasons: Object.freeze(reasons),
  });
}
