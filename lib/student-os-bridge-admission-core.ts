export const STUDENT_OS_BRIDGE_ADMISSION_DEFAULTS = Object.freeze({
  globalPerMinute: 300,
  userPerMinute: 30,
  userPerHour: 300,
} as const);

export const STUDENT_OS_BRIDGE_ADMISSION_BOUNDS = Object.freeze({
  globalPerMinute: Object.freeze({ min: 1, max: 5_000 }),
  userPerMinute: Object.freeze({ min: 1, max: 300 }),
  userPerHour: Object.freeze({ min: 1, max: 5_000 }),
} as const);

export type StudentOsBridgeAdmissionConfig = Readonly<{
  globalPerMinute: number;
  userPerMinute: number;
  userPerHour: number;
}>;

function boundedInteger(
  name: string,
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}.`);
  }
  return value;
}

export function parseStudentOsBridgeAdmissionConfig(
  env: Readonly<Record<string, string | undefined>>,
): StudentOsBridgeAdmissionConfig {
  const globalPerMinute = boundedInteger(
    'NEXA_STUDENT_OS_BRIDGE_GLOBAL_LIMIT_PER_MINUTE',
    env.NEXA_STUDENT_OS_BRIDGE_GLOBAL_LIMIT_PER_MINUTE,
    STUDENT_OS_BRIDGE_ADMISSION_DEFAULTS.globalPerMinute,
    STUDENT_OS_BRIDGE_ADMISSION_BOUNDS.globalPerMinute.min,
    STUDENT_OS_BRIDGE_ADMISSION_BOUNDS.globalPerMinute.max,
  );
  const userPerMinute = boundedInteger(
    'NEXA_STUDENT_OS_BRIDGE_USER_LIMIT_PER_MINUTE',
    env.NEXA_STUDENT_OS_BRIDGE_USER_LIMIT_PER_MINUTE,
    STUDENT_OS_BRIDGE_ADMISSION_DEFAULTS.userPerMinute,
    STUDENT_OS_BRIDGE_ADMISSION_BOUNDS.userPerMinute.min,
    STUDENT_OS_BRIDGE_ADMISSION_BOUNDS.userPerMinute.max,
  );
  const userPerHour = boundedInteger(
    'NEXA_STUDENT_OS_BRIDGE_USER_LIMIT_PER_HOUR',
    env.NEXA_STUDENT_OS_BRIDGE_USER_LIMIT_PER_HOUR,
    STUDENT_OS_BRIDGE_ADMISSION_DEFAULTS.userPerHour,
    STUDENT_OS_BRIDGE_ADMISSION_BOUNDS.userPerHour.min,
    STUDENT_OS_BRIDGE_ADMISSION_BOUNDS.userPerHour.max,
  );

  if (userPerHour < userPerMinute) {
    throw new Error('NEXA_STUDENT_OS_BRIDGE_USER_LIMIT_PER_HOUR must be greater than or equal to the per-minute user limit.');
  }

  return Object.freeze({ globalPerMinute, userPerMinute, userPerHour });
}
