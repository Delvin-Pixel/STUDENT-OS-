import {
  consumeRateLimit,
  rateLimitKey,
  type RateLimitResult,
} from '@/lib/rate-limit';
import {
  parseStudentOsBridgeAdmissionConfig,
  type StudentOsBridgeAdmissionConfig,
} from '@/lib/student-os-bridge-admission-core';

export type StudentOsBridgeAdmissionScope =
  | 'global-minute'
  | 'user-minute'
  | 'user-hour';

export type StudentOsBridgeAdmissionResult =
  | Readonly<{ allowed: true; config: StudentOsBridgeAdmissionConfig }>
  | Readonly<{
      allowed: false;
      scope: StudentOsBridgeAdmissionScope;
      result: RateLimitResult;
      config: StudentOsBridgeAdmissionConfig;
    }>;

export function getStudentOsBridgeAdmissionConfig() {
  return parseStudentOsBridgeAdmissionConfig(process.env);
}

export async function enforceStudentOsBridgeAdmission(
  userId: string,
): Promise<StudentOsBridgeAdmissionResult> {
  const config = getStudentOsBridgeAdmissionConfig();

  const globalMinute = await consumeRateLimit({
    key: rateLimitKey('student-os-bridge-global-minute', 'all'),
    limit: config.globalPerMinute,
    windowSeconds: 60,
  });
  if (!globalMinute.allowed) {
    return Object.freeze({
      allowed: false,
      scope: 'global-minute',
      result: globalMinute,
      config,
    });
  }

  const userMinute = await consumeRateLimit({
    key: rateLimitKey('student-os-bridge-user-minute', userId),
    limit: config.userPerMinute,
    windowSeconds: 60,
  });
  if (!userMinute.allowed) {
    return Object.freeze({
      allowed: false,
      scope: 'user-minute',
      result: userMinute,
      config,
    });
  }

  const userHour = await consumeRateLimit({
    key: rateLimitKey('student-os-bridge-user-hour', userId),
    limit: config.userPerHour,
    windowSeconds: 60 * 60,
  });
  if (!userHour.allowed) {
    return Object.freeze({
      allowed: false,
      scope: 'user-hour',
      result: userHour,
      config,
    });
  }

  return Object.freeze({ allowed: true, config });
}
