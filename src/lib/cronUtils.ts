/**
 * Utilities for converting user-friendly schedules to cron expressions
 */

export function parseScheduleToCron(schedule: string, frequency: string): string {
  // Parse time like "09:00 AM" or "2:30 PM"
  const timeMatch = schedule.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!timeMatch) {
    throw new Error(`Invalid schedule format: ${schedule}`);
  }

  let hour = parseInt(timeMatch[1]);
  const minute = parseInt(timeMatch[2]);
  const meridiem = timeMatch[3]?.toUpperCase();

  // Convert to 24-hour format
  if (meridiem === 'PM' && hour !== 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;

  switch (frequency.toUpperCase()) {
    case 'HOURLY':
      // Every hour at :minute
      return `${minute} * * * *`;

    case 'DAILY':
      // Daily at hour:minute
      return `${minute} ${hour} * * *`;

    case 'WEEKLY':
      // Every Monday at hour:minute
      return `${minute} ${hour} * * 1`;

    default:
      throw new Error(`Unknown frequency: ${frequency}`);
  }
}

export function cronToReadable(cronExpression: string): string {
  // Simple human-readable conversion
  const parts = cronExpression.split(' ');
  if (parts.length !== 5) return cronExpression;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  if (hour === '*' && dayOfMonth === '*') {
    return `Every hour at :${minute.padStart(2, '0')}`;
  }

  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    const h = parseInt(hour);
    const m = parseInt(minute);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `Daily at ${displayHour}:${m.toString().padStart(2, '0')} ${ampm}`;
  }

  if (dayOfWeek !== '*') {
    const h = parseInt(hour);
    const m = parseInt(minute);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `Weekly on ${getDayName(dayOfWeek)} at ${displayHour}:${m.toString().padStart(2, '0')} ${ampm}`;
  }

  return cronExpression;
}

function getDayName(day: string): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayNum = parseInt(day);
  return days[dayNum] || day;
}
