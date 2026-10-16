export const NEXA_RUNTIME_ROLE = 'nexa_runtime' as const;

export type NexaRuntimeRoleSecurityStatus = 'secure' | 'insecure' | 'unavailable';
export type NexaRuntimeRoleSecurityReason =
  | 'least_privilege_violation'
  | 'attestation_unavailable'
  | null;

export type RuntimeRoleSecurityRow = Readonly<{
  role_exists: boolean;
  rolcanlogin: boolean;
  rolsuper: boolean;
  rolcreaterole: boolean;
  rolcreatedb: boolean;
  rolreplication: boolean;
  rolbypassrls: boolean;
  public_usage: boolean;
  public_create: boolean;
  db_connect: boolean;
  db_create: boolean;
  database_owned_by_runtime: boolean;
  public_schema_owned_by_runtime: boolean;
  runtime_owned_relations: number | string;
  runtime_owned_functions: number | string;
  runtime_security_definer_functions: number | string;
  public_tables: number | string;
  runtime_crud_tables: number | string;
  runtime_truncate_tables: number | string;
  runtime_references_tables: number | string;
  runtime_trigger_tables: number | string;
  runtime_maintain_tables: number | string;
  public_sequences: number | string;
  runtime_sequences: number | string;
  runtime_update_sequences: number | string;
  public_functions: number | string;
  runtime_functions: number | string;
  role_memberships: number | string;
}>;

function integer(value: number | string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function classifyNexaRuntimeRoleSecurity(
  row: RuntimeRoleSecurityRow | null | undefined,
): 'secure' | 'insecure' {
  if (!row) return 'insecure';

  const publicTables = integer(row.public_tables);
  const runtimeCrudTables = integer(row.runtime_crud_tables);
  const runtimeTruncateTables = integer(row.runtime_truncate_tables);
  const runtimeReferencesTables = integer(row.runtime_references_tables);
  const runtimeTriggerTables = integer(row.runtime_trigger_tables);
  const runtimeMaintainTables = integer(row.runtime_maintain_tables);
  const publicSequences = integer(row.public_sequences);
  const runtimeSequences = integer(row.runtime_sequences);
  const runtimeUpdateSequences = integer(row.runtime_update_sequences);
  const publicFunctions = integer(row.public_functions);
  const runtimeFunctions = integer(row.runtime_functions);
  const roleMemberships = integer(row.role_memberships);
  const runtimeOwnedRelations = integer(row.runtime_owned_relations);
  const runtimeOwnedFunctions = integer(row.runtime_owned_functions);
  const runtimeSecurityDefinerFunctions = integer(row.runtime_security_definer_functions);

  if (
    publicTables === null
    || runtimeCrudTables === null
    || runtimeTruncateTables === null
    || runtimeReferencesTables === null
    || runtimeTriggerTables === null
    || runtimeMaintainTables === null
    || publicSequences === null
    || runtimeSequences === null
    || runtimeUpdateSequences === null
    || publicFunctions === null
    || runtimeFunctions === null
    || roleMemberships === null
    || runtimeOwnedRelations === null
    || runtimeOwnedFunctions === null
    || runtimeSecurityDefinerFunctions === null
  ) {
    return 'insecure';
  }

  return (
    row.role_exists === true
    && row.rolcanlogin === true
    && row.rolsuper === false
    && row.rolcreaterole === false
    && row.rolcreatedb === false
    && row.rolreplication === false
    && row.rolbypassrls === false
    && row.public_usage === true
    && row.public_create === false
    && row.db_connect === true
    && row.db_create === false
    && row.database_owned_by_runtime === false
    && row.public_schema_owned_by_runtime === false
    && runtimeOwnedRelations === 0
    && runtimeOwnedFunctions === 0
    && runtimeSecurityDefinerFunctions === 0
    && roleMemberships === 0
    && runtimeCrudTables === publicTables
    && runtimeTruncateTables === 0
    && runtimeReferencesTables === 0
    && runtimeTriggerTables === 0
    && runtimeMaintainTables === 0
    && runtimeSequences === publicSequences
    && runtimeUpdateSequences === 0
    && runtimeFunctions === publicFunctions
  )
    ? 'secure'
    : 'insecure';
}
