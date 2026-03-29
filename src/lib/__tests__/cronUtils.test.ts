import { parseScheduleToCron, cronToReadable } from '../cronUtils';

describe('parseScheduleToCron', () => {
  describe('DAILY frequency', () => {
    it('converts 12-hour AM time to daily cron', () => {
      expect(parseScheduleToCron('09:00 AM', 'DAILY')).toBe('0 9 * * *');
    });

    it('converts 12-hour PM time to daily cron', () => {
      expect(parseScheduleToCron('02:30 PM', 'DAILY')).toBe('30 14 * * *');
    });

    it('handles 12:00 PM (noon) correctly', () => {
      expect(parseScheduleToCron('12:00 PM', 'DAILY')).toBe('0 12 * * *');
    });

    it('handles 12:00 AM (midnight) correctly', () => {
      expect(parseScheduleToCron('12:00 AM', 'DAILY')).toBe('0 0 * * *');
    });

    it('handles case-insensitive am/pm', () => {
      expect(parseScheduleToCron('03:15 pm', 'DAILY')).toBe('15 15 * * *');
    });

    it('handles time without AM/PM meridiem', () => {
      expect(parseScheduleToCron('14:45', 'DAILY')).toBe('45 14 * * *');
    });
  });

  describe('WEEKLY frequency', () => {
    it('generates cron for Monday (day 1)', () => {
      expect(parseScheduleToCron('09:00 AM', 'WEEKLY')).toBe('0 9 * * 1');
    });

    it('handles PM weekly schedule', () => {
      expect(parseScheduleToCron('05:00 PM', 'WEEKLY')).toBe('0 17 * * 1');
    });
  });

  describe('HOURLY frequency', () => {
    it('generates hourly cron using only the minute', () => {
      expect(parseScheduleToCron('09:30 AM', 'HOURLY')).toBe('30 * * * *');
    });

    it('handles minute 00', () => {
      expect(parseScheduleToCron('02:00 PM', 'HOURLY')).toBe('0 * * * *');
    });
  });

  describe('case insensitivity for frequency', () => {
    it('accepts lowercase daily', () => {
      expect(parseScheduleToCron('09:00 AM', 'daily')).toBe('0 9 * * *');
    });
  });

  describe('error cases', () => {
    it('throws on invalid schedule format', () => {
      expect(() => parseScheduleToCron('not-a-time', 'DAILY')).toThrow('Invalid schedule format');
    });

    it('throws on unknown frequency', () => {
      expect(() => parseScheduleToCron('09:00 AM', 'MONTHLY')).toThrow('Unknown frequency');
    });
  });
});

describe('cronToReadable', () => {
  it('converts a daily cron to readable string', () => {
    const result = cronToReadable('0 9 * * *');
    expect(result).toBe('Daily at 9:00 AM');
  });

  it('converts a PM daily cron correctly', () => {
    const result = cronToReadable('30 14 * * *');
    expect(result).toBe('Daily at 2:30 PM');
  });

  it('converts midnight daily cron', () => {
    const result = cronToReadable('0 0 * * *');
    expect(result).toBe('Daily at 12:00 AM');
  });

  it('converts noon daily cron', () => {
    const result = cronToReadable('0 12 * * *');
    expect(result).toBe('Daily at 12:00 PM');
  });

  it('converts a weekly cron to readable string with day name', () => {
    const result = cronToReadable('0 9 * * 1');
    expect(result).toBe('Weekly on Monday at 9:00 AM');
  });

  it('converts hourly cron to readable string', () => {
    const result = cronToReadable('30 * * * *');
    expect(result).toBe('Every hour at :30');
  });

  it('returns original expression for invalid cron (not 5 parts)', () => {
    const expr = '0 9 *';
    expect(cronToReadable(expr)).toBe(expr);
  });

  it('converts weekly Sunday schedule', () => {
    const result = cronToReadable('0 10 * * 0');
    expect(result).toBe('Weekly on Sunday at 10:00 AM');
  });

  it('converts weekly Saturday schedule', () => {
    const result = cronToReadable('0 17 * * 6');
    expect(result).toBe('Weekly on Saturday at 5:00 PM');
  });
});
