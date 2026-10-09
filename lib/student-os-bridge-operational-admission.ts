import {
  getNexaAiGatewayReadiness,
  type NexaAiGatewayReadiness,
  type NexaAiGatewayReadinessReason,
} from '@/lib/ai-gateway-readiness';

export type StudentOsBridgeOperationalAdmission =
  | Readonly<{ allowed: true }>
  | Readonly<{
      allowed: false;
      status: Exclude<NexaAiGatewayReadiness['status'], 'operational'>;
      reason: NexaAiGatewayReadinessReason;
      retryable: boolean;
      retryAfterSeconds: number | null;
    }>;

const TRANSIENT_REASONS = new Set<NexaAiGatewayReadinessReason>([
  'ai_gateway_timeout',
  'ai_gateway_provider_unavailable',
  'ai_gateway_status_unavailable',
]);

export function classifyStudentOsBridgeOperationalAdmission(
  readiness: Pick<NexaAiGatewayReadiness, 'status' | 'reason'>,
): StudentOsBridgeOperationalAdmission {
  if (readiness.status === 'operational') {
    return Object.freeze({ allowed: true });
  }

  const reason = readiness.reason ?? 'ai_gateway_status_unavailable';
  const retryable = TRANSIENT_REASONS.has(reason);
  return Object.freeze({
    allowed: false,
    status: readiness.status,
    reason,
    retryable,
    retryAfterSeconds: retryable ? 30 : null,
  });
}

export async function enforceStudentOsBridgeOperationalAdmission() {
  return classifyStudentOsBridgeOperationalAdmission(
    await getNexaAiGatewayReadiness(),
  );
}
