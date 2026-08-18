import { formatRelativeTime } from '../src/ui/relativeTime.ts';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const NOW = new Date('2026-08-18T12:00:00Z');
const ago = (elapsed: number) => new Date(NOW.getTime() - elapsed);

describe('formatRelativeTime', () => {
    test('reads anything under a minute as just now', () => {
        expect(formatRelativeTime(ago(0), NOW)).toBe('just now');
        expect(formatRelativeTime(ago(59 * SECOND), NOW)).toBe('just now');
    });

    test('counts whole minutes below an hour', () => {
        expect(formatRelativeTime(ago(MINUTE), NOW)).toBe('1m ago');
        expect(formatRelativeTime(ago(59 * MINUTE), NOW)).toBe('59m ago');
    });

    test('counts whole hours below a day', () => {
        expect(formatRelativeTime(ago(HOUR), NOW)).toBe('1h ago');
        expect(formatRelativeTime(ago(90 * MINUTE), NOW)).toBe('1h ago');
        expect(formatRelativeTime(ago(23 * HOUR), NOW)).toBe('23h ago');
    });

    test('counts whole days below a week', () => {
        expect(formatRelativeTime(ago(DAY), NOW)).toBe('1d ago');
        expect(formatRelativeTime(ago(6 * DAY), NOW)).toBe('6d ago');
    });

    test('falls back to a date once a week has passed', () => {
        const result = formatRelativeTime(ago(8 * DAY), NOW);

        expect(result).not.toContain('ago');
        expect(result).toContain('2026');
    });

    // A device clock correction can leave an event stamped in the future, and
    // "-3m ago" is worse than saying nothing precise.
    test('does not produce negative times for a future date', () => {
        expect(formatRelativeTime(ago(-5 * HOUR), NOW)).toBe('just now');
    });
});
