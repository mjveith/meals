const DAY_MS = 24 * 60 * 60 * 1000;

export function getMonday(date = new Date()): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const day = result.getDay();
  const diff = day === 0 ? 1 : 1 - day;
  result.setDate(result.getDate() + diff);
  return result;
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function formatDay(dateString: string): { weekday: string; label: string } {
  const date = new Date(`${dateString}T12:00:00`);
  return {
    weekday: date.toLocaleDateString(undefined, { weekday: "short" }),
    label: date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  };
}

export function formatWeekLabel(weekOf: string): string {
  const date = new Date(`${weekOf}T12:00:00`);
  return `Week of ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

export function formatSavedAt(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}
