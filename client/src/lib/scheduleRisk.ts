export type DeadlineCapacity = {
  title: string;
  dueDate: string;
  estimatedMinutes: number;
};
export type ScheduledCapacity = { date: string; duration: number };

function nextDate(date: string) {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

export function deadlineRiskWarnings(
  deadlines: DeadlineCapacity[],
  today: string,
  dailyCapacity: number,
  windowMinutes: number,
  activeSessions: ScheduledCapacity[] = []
) {
  const usablePerDay = Math.max(0, Math.min(dailyCapacity, windowMinutes));
  const committedByDate = new Map<string, number>();
  activeSessions.forEach(session =>
    committedByDate.set(
      session.date,
      (committedByDate.get(session.date) ?? 0) + session.duration
    )
  );
  let requiredMinutesThroughDeadline = 0;
  return [...deadlines]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map(deadline => {
      requiredMinutesThroughDeadline += deadline.estimatedMinutes;
      const days = Math.max(
        1,
        Math.floor(
          (new Date(`${deadline.dueDate}T00:00:00Z`).getTime() -
            new Date(`${today}T00:00:00Z`).getTime()) /
            86_400_000
        ) + 1
      );
      let availableMinutes = 0;
      for (let date = today; date <= deadline.dueDate; date = nextDate(date)) {
        availableMinutes += Math.max(
          0,
          usablePerDay - (committedByDate.get(date) ?? 0)
        );
      }
      return {
        ...deadline,
        days,
        availableMinutes,
        requiredMinutesThroughDeadline,
        atRisk: requiredMinutesThroughDeadline > availableMinutes,
      };
    })
    .filter(warning => warning.atRisk);
}
