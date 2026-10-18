export type RuntimeRoleDefaultPrivilegeRow = Readonly<{
  default_acl_groups: number | string;
  default_table_acl_groups: number | string;
  default_sequence_acl_groups: number | string;
  default_function_acl_groups: number | string;
  default_acl_mismatched_groups: number | string;
  default_acl_grant_option_groups: number | string;
  default_acl_outside_public_groups: number | string;
}>;

function integer(value: number | string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function classifyNexaRuntimeDefaultPrivileges(
  row: RuntimeRoleDefaultPrivilegeRow | null | undefined,
): 'secure' | 'insecure' {
  if (!row) return 'insecure';

  const groups = integer(row.default_acl_groups);
  const tableGroups = integer(row.default_table_acl_groups);
  const sequenceGroups = integer(row.default_sequence_acl_groups);
  const functionGroups = integer(row.default_function_acl_groups);
  const mismatchedGroups = integer(row.default_acl_mismatched_groups);
  const grantOptionGroups = integer(row.default_acl_grant_option_groups);
  const outsidePublicGroups = integer(row.default_acl_outside_public_groups);

  if (
    groups === null
    || tableGroups === null
    || sequenceGroups === null
    || functionGroups === null
    || mismatchedGroups === null
    || grantOptionGroups === null
    || outsidePublicGroups === null
  ) {
    return 'insecure';
  }

  return (
    groups >= 3
    && tableGroups >= 1
    && sequenceGroups >= 1
    && functionGroups >= 1
    && mismatchedGroups === 0
    && grantOptionGroups === 0
    && outsidePublicGroups === 0
  )
    ? 'secure'
    : 'insecure';
}
