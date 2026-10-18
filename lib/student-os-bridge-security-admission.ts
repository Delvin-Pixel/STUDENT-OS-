import { getNexaRuntimeRoleSecurity } from '@/lib/runtime-role-security';
import { getNexaDataApiIsolationReadiness } from '@/lib/supabase-data-api-isolation';
import { classifyStudentOsBridgeSecurityAdmission } from '@/lib/student-os-bridge-security-admission-core';

export async function enforceStudentOsBridgeSecurityAdmission() {
  const [runtimeRoleSecurity, dataApiIsolation] = await Promise.all([
    getNexaRuntimeRoleSecurity(),
    getNexaDataApiIsolationReadiness(),
  ]);

  return classifyStudentOsBridgeSecurityAdmission({
    runtimeRoleStatus: runtimeRoleSecurity.status,
    dataApiIsolationStatus: dataApiIsolation.status,
  });
}
