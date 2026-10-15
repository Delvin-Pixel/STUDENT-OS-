import { getNexaRuntimeRoleSecurity } from '@/lib/runtime-role-security';
import { classifyStudentOsBridgeSecurityAdmission } from '@/lib/student-os-bridge-security-admission-core';

export async function enforceStudentOsBridgeSecurityAdmission() {
  const security = await getNexaRuntimeRoleSecurity();
  return classifyStudentOsBridgeSecurityAdmission(security.status);
}
