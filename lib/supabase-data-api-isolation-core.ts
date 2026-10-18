export type NexaDataApiIsolationStatus =
  | 'isolated'
  | 'future-default-risk'
  | 'exposed';

export type NexaDataApiIsolationRow = Readonly<{
  current_schema_exposures: number | string;
  current_table_exposures: number | string;
  current_sequence_exposures: number | string;
  current_function_exposures: number | string;
  public_default_acl_exposures: number | string;
  public_default_acl_grant_options: number | string;
}>;

function count(value: number | string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function classifyNexaDataApiIsolation(
  row: NexaDataApiIsolationRow | null | undefined,
): NexaDataApiIsolationStatus {
  if (!row) return 'exposed';

  const schema = count(row.current_schema_exposures);
  const tables = count(row.current_table_exposures);
  const sequences = count(row.current_sequence_exposures);
  const functions = count(row.current_function_exposures);
  const defaults = count(row.public_default_acl_exposures);
  const grantOptions = count(row.public_default_acl_grant_options);

  if (
    schema === null
    || tables === null
    || sequences === null
    || functions === null
    || defaults === null
    || grantOptions === null
  ) {
    return 'exposed';
  }

  if (schema > 0 || tables > 0 || sequences > 0 || functions > 0) {
    return 'exposed';
  }

  if (defaults > 0 || grantOptions > 0) {
    return 'future-default-risk';
  }

  return 'isolated';
}
