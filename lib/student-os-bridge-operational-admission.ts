import { getNexaAiGatewayReadiness } from '@/lib/ai-gateway-readiness';
import { classifyStudentOsBridgeOperationalAdmission } from '@/lib/student-os-bridge-operational-admission-core';

export async function enforceStudentOsBridgeOperationalAdmission() {
  const readiness = await getNexaAiGatewayReadiness();
  return classifyStudentOsBridgeOperationalAdmission({
    status: readiness.status,
    reason: readiness.reason,
  });
}
