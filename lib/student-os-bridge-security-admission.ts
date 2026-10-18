import { getNexaRuntimeRoleSecurity } from '@/lib/runtime-role-security';
import { getNexaDataApiIsolationReadiness } from '@/lib/supabase-data-api-isolation';
import { getNexaDataApiPlatformReadiness } from '@/lib/supabase-data-api-platform';
import { classifyStudentOsBridgeSecurityAdmission } from '@/lib/student-os-bridge-security-admission-core';

export async function enforceStudentOsBridgeSecurityAdmission() {
  const [runtimeRoleSecurity, dataApiPlatform, dataApiIsolation] = await Promise.all([
    getNexaRuntimeRoleSecurity(),
    getNexaDataApiPlatformReadiness(),
    getNexaDataApiIsolationReadiness(),
  ]);

  return classifyStudentOsBridgeSecurityAdmission({
    runtimeRoleStatus: runtimeRoleSecurity.status,
    dataApiPlatformStatus: dataApiPlatform.status,
    dataApiIsolationStatus: dataApiIsolation.status,
  });
}
