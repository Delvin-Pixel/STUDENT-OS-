const DAILY_LESSON_CACHE_PREFIX = "studentos:dailyLessons:v2:";

/** Derived lesson content is device-local but must still be partitioned by authenticated account. */
export function dailyLessonCacheKey(accountCacheScope: string) {
  return `${DAILY_LESSON_CACHE_PREFIX}${encodeURIComponent(accountCacheScope)}`;
}
