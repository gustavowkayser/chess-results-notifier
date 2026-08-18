const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/**
 * A short, human relative time. Past a week the exact date says more than a
 * growing count of days, so the count stops there.
 *
 * `now` is a parameter rather than read from the clock so this stays pure and
 * can be tested without freezing time.
 */
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
    const elapsed = now.getTime() - date.getTime();

    // Negative elapsed time lands here too: a corrected device clock can stamp
    // an event in the future, and "-5h ago" is worse than being vague.
    if (elapsed < MINUTE) {
        return 'just now';
    }

    if (elapsed < HOUR) {
        return `${Math.floor(elapsed / MINUTE)}m ago`;
    }

    if (elapsed < DAY) {
        return `${Math.floor(elapsed / HOUR)}h ago`;
    }

    if (elapsed < WEEK) {
        return `${Math.floor(elapsed / DAY)}d ago`;
    }

    return date.toLocaleDateString();
}
