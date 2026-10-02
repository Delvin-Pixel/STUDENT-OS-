export type Plan = 'free' | 'premium';

export const PLAN_LIMITS: Record<Plan, { dailyMessages: number }> = {
  free: { dailyMessages: 30 },
  premium: { dailyMessages: 250 },
};

export function getDailyMessageLimit(plan: Plan) {
  return PLAN_LIMITS[plan].dailyMessages;
}
