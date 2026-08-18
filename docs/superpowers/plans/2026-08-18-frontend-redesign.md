# Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-screen stock-Android UI with a two-screen navigated app: a home screen with a custom animated switch, an icon-based remove button and a last-changed timestamp per tournament, plus a dedicated search screen for pasting tournament URLs.

**Architecture:** `App.tsx` becomes a shell around a React Navigation native stack. Screens live in `src/ui/screens/` and receive `navigation` as a narrow, hand-written interface so tests can render them with a plain stub object and never need a navigation container. The `updatedAt` timestamp comes from the newest event already stored in the SQLite event store — no migration, no new events, no new table.

**Tech Stack:** React Native 0.87, TypeScript, Jest + react-test-renderer, `@react-navigation/native-stack`, `lucide-react-native` on `react-native-svg`, `op-sqlite`.

**Spec:** `docs/superpowers/specs/2026-08-18-frontend-redesign-design.md`

---

## Orientation for the implementer

Things about this codebase that will bite you if you do not know them:

- **Imports carry the `.ts`/`.tsx` extension.** `tsconfig.json` sets `allowImportingTsExtensions`. Follow the existing style: `import { theme } from './theme.ts';`. Test files import `../src/...` with the extension too.
- **Formatting is Prettier with 4-space tabs, single quotes, trailing commas, and `arrowParens: 'avoid'`.** Match the surrounding code.
- **The backend is event-sourced.** `tournamentService.listTournaments()` returns `Tournament` *aggregates*, not DTOs. The UI calls `.getDetails()` on them. Nothing is ever deleted; unregistering appends an event.
- **`src/api/index.ts` is the composition root.** It instantiates the SQLite database at module scope. The UI imports `tournamentService` from `'../../api'` and must not reach into `src/api/infrastructure/` directly.
- **Tests run with `npm test`.** Type-check separately with `npx tsc --noEmit`. Both must be clean before each commit.

## File structure

**Created**

| File | Responsibility |
|---|---|
| `src/ui/relativeTime.ts` | Pure `formatRelativeTime(date, now)` |
| `src/ui/Switch.tsx` | Animated switch replacing RN's `Switch` |
| `src/ui/SearchBarButton.tsx` | The tappable home-screen bar |
| `src/ui/screens/HomeScreen.tsx` | List, toggle, search bar; owns list state |
| `src/ui/screens/SearchScreen.tsx` | Query input, URL sniffing, registration |
| `src/navigation/RootNavigator.tsx` | Stack declaration and navigation theme |
| `jest.setup.js` | Stubs `lucide-react-native` |
| `__tests__/relativeTime.test.ts` | |
| `__tests__/tournamentUrl.test.ts` | |
| `__tests__/aggregate.test.ts` | |
| `__tests__/Switch.test.tsx` | |
| `__tests__/HomeScreen.test.tsx` | |
| `__tests__/SearchScreen.test.tsx` | |

**Modified**

| File | Change |
|---|---|
| `src/ui/theme.ts` | Two new tokens |
| `src/ui/TournamentCard.tsx` | Trash icon, `updatedAt` on the model, meta line |
| `src/api/domain/AggregateRoot.ts` | `getUpdatedAt()` |
| `src/api/infrastructure/chessresults/ChessResultsUrl.ts` | `isTournamentUrl()` |
| `src/api/index.ts` | Re-export `isTournamentUrl` |
| `App.tsx` | Reduced to a shell |
| `jest.config.js` | `setupFilesAfterEnv` |
| `package.json` | Five dependencies |
| `android/app/src/main/java/com/chessresultsnotifier/MainActivity.kt` | `onCreate(null)` for `react-native-screens` |

**Deleted**

| File | Reason |
|---|---|
| `src/ui/NotificationsToggle.tsx` | Absorbed into `HomeScreen` with the new `Switch` |
| `src/ui/TournamentInput.tsx` | Replaced by `SearchScreen` |
| `__tests__/App.test.tsx` | Superseded by the two screen tests |

**Task order:** Tasks 1–3 are pure logic with no new dependencies and can be done immediately. Task 4 installs everything native. Tasks 5–10 are UI. Task 11 is the device rebuild.

---

### Task 1: Relative time formatting

**Files:**
- Create: `src/ui/relativeTime.ts`
- Test: `__tests__/relativeTime.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/relativeTime.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/relativeTime.test.ts`
Expected: FAIL — `Cannot find module '../src/ui/relativeTime.ts'`

- [ ] **Step 3: Write the implementation**

Create `src/ui/relativeTime.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/relativeTime.test.ts`
Expected: PASS, 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/ui/relativeTime.ts __tests__/relativeTime.test.ts
git commit -m "feat: Add relative time formatting"
```

---

### Task 2: A non-throwing tournament URL check

`ChessResultsUrl.parse` throws on a non-match, which is correct for the service and wrong for a field someone is still typing into. The UI needs a predicate — and it must reuse the existing regex rather than growing a second copy.

**Files:**
- Modify: `src/api/infrastructure/chessresults/ChessResultsUrl.ts`
- Modify: `src/api/index.ts`
- Test: `__tests__/tournamentUrl.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/tournamentUrl.test.ts`:

```ts
import { ChessResultsUrl } from '../src/api/infrastructure/chessresults/ChessResultsUrl.ts';

describe('ChessResultsUrl.isTournamentUrl', () => {
    test('accepts a tournament URL on any mirror', () => {
        expect(
            ChessResultsUrl.isTournamentUrl(
                'https://s1.chess-results.com/tnr1477210.aspx',
            ),
        ).toBe(true);
        expect(
            ChessResultsUrl.isTournamentUrl(
                'https://s3.chess-results.com/tnr9.aspx?lan=1',
            ),
        ).toBe(true);
        expect(
            ChessResultsUrl.isTournamentUrl(
                'http://chess-results.com/tnr42.aspx',
            ),
        ).toBe(true);
    });

    test('ignores surrounding whitespace, as a paste often carries', () => {
        expect(
            ChessResultsUrl.isTournamentUrl(
                '  https://s1.chess-results.com/tnr1477210.aspx  ',
            ),
        ).toBe(true);
    });

    test('rejects prose and non-tournament pages', () => {
        expect(ChessResultsUrl.isTournamentUrl('Magnus Carlsen')).toBe(false);
        expect(ChessResultsUrl.isTournamentUrl('')).toBe(false);
        expect(
            ChessResultsUrl.isTournamentUrl('https://chess-results.com/'),
        ).toBe(false);
        expect(
            ChessResultsUrl.isTournamentUrl('https://lichess.org/tnr1.aspx'),
        ).toBe(false);
    });

    // Half-typed input is the common case on a search screen, and it must read
    // as "not yet", never as an error.
    test('rejects a partially typed URL', () => {
        expect(ChessResultsUrl.isTournamentUrl('https://s1.chess-res')).toBe(
            false,
        );
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/tournamentUrl.test.ts`
Expected: FAIL — `ChessResultsUrl.isTournamentUrl is not a function`

- [ ] **Step 3: Add the predicate**

In `src/api/infrastructure/chessresults/ChessResultsUrl.ts`, add this method directly above `public static parse`:

```ts
    /**
     * Whether the text is a tournament address, without throwing. `parse` is
     * right to reject loudly for the service; a field being typed into needs
     * the question answered quietly.
     */
    public static isTournamentUrl(text: string): boolean {
        return TOURNAMENT_URL.test(text.trim());
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/tournamentUrl.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 5: Re-export from the composition root**

The UI must not import from `src/api/infrastructure/`. In `src/api/index.ts`, add the import alongside the existing ones:

```ts
import { ChessResultsUrl } from './infrastructure/chessresults/ChessResultsUrl.ts';
```

and add this above the final export line:

```ts
/**
 * Whether text names a chess-results tournament. Exported so the search screen
 * can tell a URL from a player name without a second copy of the pattern.
 */
const isTournamentUrl = (text: string): boolean =>
    ChessResultsUrl.isTournamentUrl(text);
```

then change the final line to:

```ts
export { tournamentService, monitoringService, isTournamentUrl };
```

- [ ] **Step 6: Verify the suite and types are clean**

Run: `npm test && npx tsc --noEmit`
Expected: all tests PASS, no type errors

- [ ] **Step 7: Commit**

```bash
git add src/api/infrastructure/chessresults/ChessResultsUrl.ts src/api/index.ts __tests__/tournamentUrl.test.ts
git commit -m "feat: Add a non-throwing tournament URL check"
```

---

### Task 3: `updatedAt` on the aggregate

**Files:**
- Modify: `src/api/domain/AggregateRoot.ts`
- Test: `__tests__/aggregate.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/aggregate.test.ts`:

```ts
import { RoundPublished } from '../src/api/domain/events/RoundPublished.ts';
import { Tournament } from '../src/api/domain/Tournament.ts';
import { TournamentDetails } from '../src/api/domain/TournamentDetails.ts';
import { TournamentRegistered } from '../src/api/domain/events/TournamentRegistered.ts';

const ID = 'https://s1.chess-results.com/tnr1.aspx';

describe('AggregateRoot.getUpdatedAt', () => {
    test('reports the timestamp of the newest replayed event', () => {
        const tournament = Tournament.rehydrate(ID, [
            new TournamentRegistered(
                ID,
                ID,
                'Goiano Blitz',
                1,
                7,
                new Date('2026-08-01T10:00:00Z'),
            ),
            new RoundPublished(ID, 2, 7, new Date('2026-08-03T18:30:00Z')),
        ]);

        expect(tournament.getUpdatedAt()).toEqual(
            new Date('2026-08-03T18:30:00Z'),
        );
    });

    test('reports nothing for an aggregate with no events', () => {
        expect(Tournament.rehydrate(ID, []).getUpdatedAt()).toBeNull();
    });

    // apply() and replay() have to agree, or a card would change its timestamp
    // the moment the app restarted.
    test('tracks events applied now, not only replayed ones', () => {
        const before = Date.now();

        const tournament = Tournament.register(
            ID,
            new TournamentDetails('Goiano Blitz', 0, 7),
        );

        const updatedAt = tournament.getUpdatedAt();

        expect(updatedAt).not.toBeNull();
        expect(updatedAt!.getTime()).toBeGreaterThanOrEqual(before);
    });

    test('advances when a later event is applied', () => {
        const tournament = Tournament.rehydrate(ID, [
            new TournamentRegistered(
                ID,
                ID,
                'Goiano Blitz',
                1,
                7,
                new Date('2026-08-01T10:00:00Z'),
            ),
        ]);

        tournament.observe(new TournamentDetails('Goiano Blitz', 2, 7));

        expect(tournament.getUpdatedAt()!.getTime()).toBeGreaterThan(
            new Date('2026-08-01T10:00:00Z').getTime(),
        );
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/aggregate.test.ts`
Expected: FAIL — `tournament.getUpdatedAt is not a function`

- [ ] **Step 3: Implement it**

Replace the whole body of `src/api/domain/AggregateRoot.ts` with:

```ts
import { DomainEvent } from './DomainEvent.ts';

export abstract class AggregateRoot {
    private domainEvents: DomainEvent[] = [];
    private updatedAt: Date | null = null;

    protected constructor(public readonly id: string) {}

    public getEvents(): readonly DomainEvent[] {
        return this.domainEvents;
    }

    public pullEvents(): DomainEvent[] {
        const events = this.domainEvents;
        this.domainEvents = [];

        return events;
    }

    /**
     * When the aggregate last changed — the timestamp of its newest event, or
     * null when it has none. This is "last change", not "last checked": a
     * monitoring tick that sees nothing new writes no event by design.
     */
    public getUpdatedAt(): Date | null {
        return this.updatedAt;
    }

    protected apply(event: DomainEvent) {
        this.track(event);
        this.domainEvents.push(event);

        return event;
    }

    public replay(events: readonly DomainEvent[]) {
        for (const event of events) {
            this.track(event);
        }
    }

    // Both paths go through here so a rehydrated aggregate cannot disagree
    // with one that was mutated in this session.
    private track(event: DomainEvent) {
        this.mutate(event);
        this.updatedAt = event.occurredAt;
    }

    protected abstract mutate(event: DomainEvent): void;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/aggregate.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 5: Verify nothing else regressed**

Run: `npm test && npx tsc --noEmit`
Expected: all tests PASS, no type errors. `occurred_at` already round-trips through `DomainEventSerializer`, so stored streams need no migration.

- [ ] **Step 6: Commit**

```bash
git add src/api/domain/AggregateRoot.ts __tests__/aggregate.test.ts
git commit -m "feat: Track when an aggregate last changed"
```

---

### Task 4: Install dependencies and stub icons in Jest

No behaviour changes here. The goal is a green suite with the new packages installed.

**Files:**
- Modify: `package.json` (via npm)
- Create: `jest.setup.js`
- Modify: `jest.config.js`

- [ ] **Step 1: Install**

```bash
npm install @react-navigation/native@^7.3.0 @react-navigation/native-stack@^7.18.0 react-native-screens@^4.27.0 react-native-svg@^15.15.0 lucide-react-native@^1.32.0
```

Expected: installs without peer-dependency errors. `lucide-react-native` peers on `react-native-svg ^12 || ^13 || ^14 || ^15`, which 15.15 satisfies.

- [ ] **Step 2: Stub the icons for Jest**

Icons carry no behaviour, and rendering them for real drags `react-native-svg`'s native views into the test renderer for no benefit.

Create `jest.setup.js`:

```js
/**
 * Lucide icons render through react-native-svg's native views, which do not
 * exist under the test renderer. They carry no behaviour worth exercising, so
 * each becomes a plain View tagged with its name.
 */
jest.mock('lucide-react-native', () => {
    const React = require('react');
    const { View } = require('react-native');

    const icon = name => props =>
        React.createElement(View, { testID: `icon-${name}`, ...props });

    return {
        ArrowLeft: icon('ArrowLeft'),
        Bell: icon('Bell'),
        Search: icon('Search'),
        Trash2: icon('Trash2'),
        X: icon('X'),
    };
});
```

- [ ] **Step 3: Register the setup file**

Replace `jest.config.js` with:

```js
module.exports = {
    preset: '@react-native/jest-preset',
    // setupFilesAfterEnv, not setupFiles: the preset already populates
    // setupFiles, and setting it here would replace it rather than add to it.
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
```

- [ ] **Step 4: Verify the suite is still green**

Run: `npm test && npx tsc --noEmit`
Expected: all existing tests PASS, no type errors

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json jest.config.js jest.setup.js
git commit -m "build: Add navigation and icon dependencies"
```

---

### Task 5: Custom switch

React Native's `Switch` renders the stock Material control on Android. This replaces it.

**Files:**
- Modify: `src/ui/theme.ts`
- Create: `src/ui/Switch.tsx`
- Test: `__tests__/Switch.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/Switch.test.tsx`:

```tsx
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Switch } from '../src/ui/Switch.tsx';

const render = async (props: {
    value: boolean;
    onValueChange: (next: boolean) => void;
    disabled?: boolean;
}) => {
    let tree!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
        tree = ReactTestRenderer.create(
            <Switch testID="notifications-switch" {...props} />,
        );
    });

    return tree.root.findByProps({ testID: 'notifications-switch' });
};

describe('Switch', () => {
    test('reports the opposite value when pressed', async () => {
        const onValueChange = jest.fn();
        const control = await render({ value: false, onValueChange });

        await ReactTestRenderer.act(async () => {
            control.props.onPress();
        });

        expect(onValueChange).toHaveBeenCalledWith(true);
    });

    test('turns off when pressed while on', async () => {
        const onValueChange = jest.fn();
        const control = await render({ value: true, onValueChange });

        await ReactTestRenderer.act(async () => {
            control.props.onPress();
        });

        expect(onValueChange).toHaveBeenCalledWith(false);
    });

    // Screen readers announce this, and it is the only externally visible
    // record of the switch's state now that it is not RN's Switch.
    test('exposes its state to accessibility', async () => {
        const control = await render({ value: true, onValueChange: jest.fn() });

        expect(control.props.accessibilityRole).toBe('switch');
        expect(control.props.accessibilityState).toEqual({
            checked: true,
            disabled: false,
        });
    });

    test('is disabled while busy', async () => {
        const control = await render({
            value: false,
            onValueChange: jest.fn(),
            disabled: true,
        });

        expect(control.props.disabled).toBe(true);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/Switch.test.tsx`
Expected: FAIL — `Cannot find module '../src/ui/Switch.tsx'`

- [ ] **Step 3: Add the theme tokens**

Replace `src/ui/theme.ts` with:

```ts
export const theme = {
    background: '#12141a',
    card: '#1c1f27',
    // One step above card, for controls that should read as interactive.
    surface: '#232733',
    border: '#2b303b',
    text: '#e6e8ec',
    muted: '#9aa3b2',
    accent: '#4f8cc9',
    switchTrackOff: '#39404e',
    danger: '#c9524d',
} as const;
```

- [ ] **Step 4: Write the switch**

Create `src/ui/Switch.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { theme } from './theme.ts';

const TRACK_WIDTH = 52;
const TRACK_HEIGHT = 32;
const THUMB_SIZE = 26;
const PADDING = (TRACK_HEIGHT - THUMB_SIZE) / 2;
const TRAVEL = TRACK_WIDTH - THUMB_SIZE - PADDING * 2;

/**
 * Replaces React Native's Switch, which renders the stock Material control on
 * Android and ignores most styling.
 */
export function Switch({
    value,
    onValueChange,
    disabled = false,
    testID,
}: {
    value: boolean;
    onValueChange: (next: boolean) => void;
    disabled?: boolean;
    testID?: string;
}) {
    const progress = useRef(new Animated.Value(value ? 1 : 0)).current;

    useEffect(() => {
        Animated.timing(progress, {
            toValue: value ? 1 : 0,
            duration: 200,
            // The track colour animates, and colour cannot be driven on the UI
            // thread. Splitting this into two animations to native-drive the
            // thumb alone is not worth the complexity for a 200ms transition.
            useNativeDriver: false,
        }).start();
    }, [progress, value]);

    return (
        <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: value, disabled }}
            disabled={disabled}
            onPress={() => onValueChange(!value)}
            testID={testID}
        >
            <Animated.View
                style={[
                    styles.track,
                    disabled && styles.disabled,
                    {
                        backgroundColor: progress.interpolate({
                            inputRange: [0, 1],
                            outputRange: [theme.switchTrackOff, theme.accent],
                        }),
                    },
                ]}
            >
                <Animated.View
                    style={[
                        styles.thumb,
                        {
                            transform: [
                                {
                                    translateX: progress.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0, TRAVEL],
                                    }),
                                },
                            ],
                        },
                    ]}
                />
            </Animated.View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    track: {
        width: TRACK_WIDTH,
        height: TRACK_HEIGHT,
        borderRadius: TRACK_HEIGHT / 2,
        padding: PADDING,
        justifyContent: 'center',
    },
    thumb: {
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        borderRadius: THUMB_SIZE / 2,
        backgroundColor: '#ffffff',
    },
    disabled: {
        opacity: 0.5,
    },
});
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest __tests__/Switch.test.tsx`
Expected: PASS, 4 tests

- [ ] **Step 6: Commit**

```bash
git add src/ui/Switch.tsx src/ui/theme.ts __tests__/Switch.test.tsx
git commit -m "feat: Add a custom animated switch"
```

---

### Task 6: Tournament card — trash icon and timestamp

The card model gains `updatedAt`. `App.tsx` still builds that model at this point, so it is updated here to keep the tree compiling and the existing test green; Task 9 moves the mapping into `HomeScreen`.

**Files:**
- Modify: `src/ui/TournamentCard.tsx`
- Modify: `App.tsx:58-63`
- Modify: `__tests__/App.test.tsx:43-51`

- [ ] **Step 1: Extend the existing test to expect a timestamp**

In `__tests__/App.test.tsx`, replace the `aggregate` helper (lines 42–51) with:

```tsx
/** A tournament as listTournaments returns it: an aggregate, not a DTO. */
const aggregate = (
    id: string,
    name: string,
    currentRound: number,
    totalRounds: number,
    updatedAt: Date | null = new Date(),
) => ({
    id,
    getDetails: () => ({ name, currentRound, totalRounds }),
    getUpdatedAt: () => updatedAt,
});
```

Then add this test inside the `describe('tournament list', ...)` block:

```tsx
    test('shows how long ago the tournament last changed', async () => {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

        mockListTournaments.mockResolvedValue([
            aggregate(
                'https://s1.chess-results.com/tnr1.aspx',
                'Goiano Blitz',
                5,
                7,
                twoHoursAgo,
            ),
        ]);

        const { text } = await render();

        expect(text()).toContain('2h ago');
    });

    // A stream with no events cannot claim a time, and "· " dangling off the
    // round reads as a rendering bug.
    test('omits the timestamp when the aggregate has none', async () => {
        mockListTournaments.mockResolvedValue([
            aggregate(
                'https://s1.chess-results.com/tnr1.aspx',
                'Goiano Blitz',
                5,
                7,
                null,
            ),
        ]);

        const { text } = await render();

        expect(text()).toContain('Round 5 of 7');
        expect(text()).not.toContain('·');
    });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/App.test.tsx -t 'how long ago'`
Expected: FAIL — the rendered text has no `2h ago`

- [ ] **Step 3: Rewrite the card**

Replace `src/ui/TournamentCard.tsx` with:

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { formatRelativeTime } from './relativeTime.ts';
import { theme } from './theme.ts';

export interface TournamentCardModel {
    id: string;
    name: string;
    currentRound: number;
    totalRounds: number;
    updatedAt: Date | null;
}

const roundLabel = ({ currentRound, totalRounds }: TournamentCardModel) => {
    // A tournament registered before its first pairings went up has no round
    // yet, and "Round 0 of 7" reads like an error.
    if (currentRound === 0) {
        return 'No pairings yet';
    }

    // Events written before totalRounds existed replay as 0, and a schedule can
    // in principle shrink. Either way "Round 5 of 0" is worse than saying less;
    // the next observed round restores the total.
    if (totalRounds < currentRound) {
        return `Round ${currentRound}`;
    }

    return `Round ${currentRound} of ${totalRounds}`;
};

/**
 * The round and when it went up. The timestamp is the aggregate's last change,
 * so it sits next to the round it describes rather than reading as a freshness
 * check on the app.
 */
const metaLabel = (tournament: TournamentCardModel) => {
    const round = roundLabel(tournament);

    if (tournament.updatedAt === null) {
        return round;
    }

    return `${round} · ${formatRelativeTime(tournament.updatedAt)}`;
};

export function TournamentCard({
    tournament,
    onUnregister,
}: {
    tournament: TournamentCardModel;
    onUnregister: (id: string) => void | Promise<void>;
}) {
    return (
        <View style={styles.card}>
            <View style={styles.details}>
                <Text style={styles.name} numberOfLines={2}>
                    {tournament.name}
                </Text>
                <Text style={styles.meta}>{metaLabel(tournament)}</Text>
            </View>

            <Pressable
                style={styles.remove}
                onPress={() => onUnregister(tournament.id)}
                testID={`unregister-${tournament.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Stop tracking ${tournament.name}`}
                hitSlop={8}
            >
                <Trash2 size={18} color={theme.danger} />
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: theme.card,
        borderColor: theme.border,
        borderWidth: 1,
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
    },
    details: {
        flex: 1,
    },
    name: {
        color: theme.text,
        fontSize: 15,
        fontWeight: '600',
    },
    meta: {
        color: theme.muted,
        fontSize: 13,
        marginTop: 4,
    },
    // A bare 18px icon is an unmissable tap target on paper and a frustrating
    // one in the hand, so the pressable is padded out to 40.
    remove: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 10,
    },
});
```

- [ ] **Step 4: Feed `updatedAt` through App.tsx**

In `App.tsx`, in the `refresh` callback, replace the returned object (lines 58–63) with:

```tsx
                return {
                    id: tournament.id,
                    name: details.name,
                    currentRound: details.currentRound,
                    totalRounds: details.totalRounds,
                    updatedAt: tournament.getUpdatedAt(),
                };
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test && npx tsc --noEmit`
Expected: all tests PASS including the two new ones, no type errors

- [ ] **Step 6: Commit**

```bash
git add src/ui/TournamentCard.tsx App.tsx __tests__/App.test.tsx
git commit -m "feat: Show a trash icon and last-changed time on tournament cards"
```

---

### Task 7: Home search bar

**Files:**
- Create: `src/ui/SearchBarButton.tsx`

No test of its own — it is a `Pressable` wrapping a `Text`, and Task 9 asserts that tapping it navigates.

- [ ] **Step 1: Write the component**

Create `src/ui/SearchBarButton.tsx`:

```tsx
import { Pressable, StyleSheet, Text } from 'react-native';
import { Search } from 'lucide-react-native';
import { theme } from './theme.ts';

const PLACEHOLDER = 'Add a tournament or search…';

/**
 * Looks like the search field it opens, but is a button: tapping it navigates
 * rather than raising a keyboard over the list.
 */
export function SearchBarButton({ onPress }: { onPress: () => void }) {
    return (
        <Pressable
            style={styles.bar}
            onPress={onPress}
            testID="open-search"
            accessibilityRole="button"
            accessibilityLabel={PLACEHOLDER}
        >
            <Search size={18} color={theme.muted} />
            <Text style={styles.placeholder}>{PLACEHOLDER}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    bar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: theme.surface,
        borderColor: theme.border,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    placeholder: {
        color: theme.muted,
        fontSize: 15,
    },
});
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/ui/SearchBarButton.tsx
git commit -m "feat: Add the home search bar button"
```

---

### Task 8: Search screen

One field. A chess-results URL produces a tappable result row that registers the tournament; anything else produces the coming-soon state. Presenting the valid URL as a *result row* rather than firing on submit alone is what makes this screen already the shape player search needs — a list of things you tap.

`navigation` is a hand-written interface, not React Navigation's type, so the test can pass a plain object and never mount a navigation container.

**Files:**
- Create: `src/ui/screens/SearchScreen.tsx`
- Test: `__tests__/SearchScreen.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/SearchScreen.test.tsx`:

```tsx
import React from 'react';
import { TextInput } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { SearchScreen } from '../src/ui/screens/SearchScreen.tsx';

const mockRegisterTournament = jest.fn();

jest.mock('../src/api', () => ({
    tournamentService: {
        registerTournament: (url: string) => mockRegisterTournament(url),
    },
    // The real predicate is exercised in tournamentUrl.test.ts; here it has to
    // behave, not be stubbed, or the screen's branching is untested.
    isTournamentUrl: (text: string) =>
        /^https?:\/\/(?:[a-z0-9-]+\.)*chess-results\.com\/tnr\d+\.aspx/i.test(
            text.trim(),
        ),
}));

jest.mock('react-native-safe-area-context', () =>
    require('react-native-safe-area-context/jest/mock').default,
);

const URL = 'https://s1.chess-results.com/tnr1477210.aspx';

const render = async () => {
    const goBack = jest.fn();
    let tree!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
        tree = ReactTestRenderer.create(
            <SearchScreen navigation={{ goBack }} />,
        );
    });

    const act = async (work: () => unknown) =>
        await ReactTestRenderer.act(async () => {
            work();
        });

    return {
        goBack,
        type: (text: string) =>
            act(() =>
                tree.root
                    .findByType(TextInput as never)
                    .props.onChangeText(text),
            ),
        back: () =>
            act(() =>
                tree.root
                    .findByProps({ testID: 'search-back' })
                    .props.onPress(),
            ),
        submit: () =>
            act(() =>
                tree.root
                    .findByProps({ testID: 'register-tournament' })
                    .props.onPress(),
            ),
        hasResult: () =>
            tree.root.findAllByProps({ testID: 'register-tournament' }).length >
            0,
        text: () =>
            tree.root
                .findAll(node => typeof node.props.children === 'string')
                .map(node => String(node.props.children))
                .join('\n'),
    };
};

beforeEach(() => {
    jest.clearAllMocks();
    mockRegisterTournament.mockResolvedValue(undefined);
});

describe('search screen', () => {
    test('explains what to paste before anything is typed', async () => {
        const { text, hasResult } = await render();

        expect(text()).toContain('chess-results');
        expect(hasResult()).toBe(false);
    });

    test('offers a tournament result for a pasted URL', async () => {
        const { type, hasResult } = await render();

        await type(URL);

        expect(hasResult()).toBe(true);
    });

    test('registers the trimmed URL and returns home', async () => {
        const { type, submit, goBack } = await render();

        await type(`  ${URL}  `);
        await submit();

        expect(mockRegisterTournament).toHaveBeenCalledWith(URL);
        expect(goBack).toHaveBeenCalled();
    });

    test('shows a rejected URL and stays put', async () => {
        mockRegisterTournament.mockRejectedValue(
            new Error('Tournament page could not be read'),
        );

        const { type, submit, goBack, text } = await render();

        await type(URL);
        await submit();

        expect(text()).toContain('Tournament page could not be read');
        expect(goBack).not.toHaveBeenCalled();
    });

    // Typing a player's name is not a mistake, it is the unbuilt half of this
    // screen, so it must not read as an error.
    test('treats non-URL text as a pending feature, not a failure', async () => {
        const { type, text, hasResult } = await render();

        await type('Magnus Carlsen');

        expect(text()).toContain('coming soon');
        expect(hasResult()).toBe(false);
        expect(mockRegisterTournament).not.toHaveBeenCalled();
    });

    test('goes back when the back control is used', async () => {
        const { back, goBack } = await render();

        await back();

        expect(goBack).toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/SearchScreen.test.tsx`
Expected: FAIL — `Cannot find module '../src/ui/screens/SearchScreen.tsx'`

- [ ] **Step 3: Write the screen**

Create `src/ui/screens/SearchScreen.tsx`:

```tsx
import { useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Search, X } from 'lucide-react-native';
import { isTournamentUrl, tournamentService } from '../../api';
import { theme } from '../theme.ts';

const PLACEHOLDER = 'Paste a chess-results link…';

/**
 * The subset of the navigation object this screen uses. Hand-written rather
 * than imported so the screen can be rendered in a test with a plain object.
 */
export interface SearchScreenNavigation {
    goBack: () => void;
}

export function SearchScreen({
    navigation,
}: {
    navigation: SearchScreenNavigation;
}) {
    const safeAreaInsets = useSafeAreaInsets();

    const [query, setQuery] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const trimmed = query.trim();
    const isUrl = isTournamentUrl(trimmed);

    const register = async () => {
        if (!isUrl || busy) {
            return;
        }

        // Registering scrapes chess-results, so it is slow enough to need a
        // pending state and can fail on the network or a dead tournament.
        setBusy(true);
        setError(null);

        try {
            await tournamentService.registerTournament(trimmed);
            navigation.goBack();
        } catch (caught) {
            setError((caught as Error).message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <View
            style={[
                styles.container,
                { paddingTop: safeAreaInsets.top + 12 },
            ]}
        >
            <View style={styles.header}>
                <Pressable
                    style={styles.back}
                    onPress={navigation.goBack}
                    testID="search-back"
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                    hitSlop={8}
                >
                    <ArrowLeft size={20} color={theme.text} />
                </Pressable>

                <View style={styles.field}>
                    <Search size={18} color={theme.muted} />
                    <TextInput
                        style={styles.input}
                        value={query}
                        onChangeText={setQuery}
                        placeholder={PLACEHOLDER}
                        placeholderTextColor={theme.muted}
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoFocus
                        editable={!busy}
                        returnKeyType="go"
                        onSubmitEditing={register}
                    />
                    {trimmed.length > 0 && (
                        <Pressable
                            onPress={() => {
                                setQuery('');
                                setError(null);
                            }}
                            testID="search-clear"
                            accessibilityRole="button"
                            accessibilityLabel="Clear"
                            hitSlop={8}
                        >
                            <X size={16} color={theme.muted} />
                        </Pressable>
                    )}
                </View>
            </View>

            <View style={styles.results}>
                <Results
                    busy={busy}
                    error={error}
                    isUrl={isUrl}
                    onRegister={register}
                    query={trimmed}
                />
            </View>
        </View>
    );
}

function Results({
    busy,
    error,
    isUrl,
    onRegister,
    query,
}: {
    busy: boolean;
    error: string | null;
    isUrl: boolean;
    onRegister: () => void;
    query: string;
}) {
    if (busy) {
        return (
            <View style={styles.pending}>
                <ActivityIndicator color={theme.accent} />
                <Text style={styles.hint}>Fetching tournament…</Text>
            </View>
        );
    }

    if (error !== null) {
        return <Text style={styles.error}>{error}</Text>;
    }

    if (isUrl) {
        return (
            <Pressable
                style={styles.result}
                onPress={onRegister}
                testID="register-tournament"
                accessibilityRole="button"
            >
                <Text style={styles.resultTitle}>Track this tournament</Text>
                <Text style={styles.resultSubtitle} numberOfLines={1}>
                    {query}
                </Text>
            </Pressable>
        );
    }

    // Not an error: player search is the unbuilt half of this screen, and a
    // name typed into it is the user reaching for it early.
    if (query.length > 0) {
        return (
            <Text style={styles.hint}>
                Player search is coming soon. For now, paste a chess-results
                tournament link.
            </Text>
        );
    }

    // Two Text nodes rather than one with a {'\n'} in it: an interpolated
    // newline turns the element's children into an array, and the test helper
    // that scrapes rendered copy only sees string children.
    return (
        <View style={styles.idle}>
            <Text style={styles.hint}>
                Paste a chess-results tournament link to start tracking it.
            </Text>
            <Text style={styles.example}>
                https://s1.chess-results.com/tnr1477210.aspx
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 16,
        backgroundColor: theme.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    back: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    field: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: theme.surface,
        borderColor: theme.border,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 14,
    },
    input: {
        flex: 1,
        color: theme.text,
        fontSize: 15,
        paddingVertical: 10,
    },
    results: {
        flex: 1,
        marginTop: 20,
    },
    pending: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    result: {
        backgroundColor: theme.card,
        borderColor: theme.border,
        borderWidth: 1,
        borderRadius: 12,
        padding: 14,
    },
    resultTitle: {
        color: theme.text,
        fontSize: 15,
        fontWeight: '600',
    },
    resultSubtitle: {
        color: theme.muted,
        fontSize: 13,
        marginTop: 4,
    },
    idle: {
        gap: 8,
    },
    hint: {
        color: theme.muted,
        fontSize: 14,
        lineHeight: 20,
    },
    example: {
        color: theme.border,
        fontSize: 13,
    },
    error: {
        color: theme.danger,
        fontSize: 14,
        lineHeight: 20,
    },
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/SearchScreen.test.tsx`
Expected: PASS, 6 tests

- [ ] **Step 5: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/ui/screens/SearchScreen.tsx __tests__/SearchScreen.test.tsx
git commit -m "feat: Add the search screen"
```

---

### Task 9: Home screen

This is `App.tsx`'s current body, minus registration, plus the search bar and the new switch. `navigation.addListener('focus', …)` is used instead of the `useFocusEffect` hook so the screen stays renderable without a navigation container.

**Files:**
- Create: `src/ui/screens/HomeScreen.tsx`
- Test: `__tests__/HomeScreen.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/HomeScreen.test.tsx`:

```tsx
import React from 'react';
import { DeviceEventEmitter } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { HomeScreen } from '../src/ui/screens/HomeScreen.tsx';

const mockUnregisterTournament = jest.fn();
const mockListTournaments = jest.fn();

jest.mock('../src/api', () => ({
    tournamentService: {
        unregisterTournament: (url: string) => mockUnregisterTournament(url),
        listTournaments: () => mockListTournaments(),
    },
}));

const mockStart = jest.fn();
const mockStop = jest.fn();
const mockIsMonitoring = jest.fn();

jest.mock('../src/monitoring/MonitoringController', () => ({
    MonitoringController: {
        start: (seconds: number) => mockStart(seconds),
        stop: () => mockStop(),
        isMonitoring: () => mockIsMonitoring(),
    },
}));

jest.mock('react-native-safe-area-context', () =>
    require('react-native-safe-area-context/jest/mock').default,
);

/** A tournament as listTournaments returns it: an aggregate, not a DTO. */
const aggregate = (
    id: string,
    name: string,
    currentRound: number,
    totalRounds: number,
    updatedAt: Date | null = new Date(),
) => ({
    id,
    getDetails: () => ({ name, currentRound, totalRounds }),
    getUpdatedAt: () => updatedAt,
});

const render = async () => {
    const navigate = jest.fn();
    const focusListeners: Array<() => void> = [];
    const addListener = jest.fn((_event: string, listener: () => void) => {
        focusListeners.push(listener);

        return () => {};
    });

    let tree!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
        tree = ReactTestRenderer.create(
            <HomeScreen navigation={{ navigate, addListener } as never} />,
        );
    });

    const act = async (work: () => unknown) =>
        await ReactTestRenderer.act(async () => {
            work();
        });

    return {
        navigate,
        openSearch: () =>
            act(() =>
                tree.root.findByProps({ testID: 'open-search' }).props.onPress(),
            ),
        focus: () => act(() => focusListeners.forEach(listener => listener())),
        toggle: (next: boolean) =>
            act(() =>
                tree.root
                    .findByProps({ testID: 'notifications-switch' })
                    .props.onPress(next),
            ),
        switchIsOn: () =>
            tree.root.findByProps({ testID: 'notifications-switch' }).props
                .accessibilityState.checked,
        remove: (id: string) =>
            act(() =>
                tree.root
                    .findByProps({ testID: `unregister-${id}` })
                    .props.onPress(),
            ),
        text: () =>
            tree.root
                .findAll(node => typeof node.props.children === 'string')
                .map(node => String(node.props.children))
                .join('\n'),
    };
};

beforeEach(() => {
    jest.clearAllMocks();
    mockListTournaments.mockResolvedValue([]);
    mockIsMonitoring.mockResolvedValue(false);
    mockStart.mockResolvedValue(true);
});

describe('tournament list', () => {
    test('shows an empty state when nothing is tracked', async () => {
        const { text } = await render();

        expect(text()).toContain('No tournaments yet');
    });

    test('renders a card per tournament with its round', async () => {
        mockListTournaments.mockResolvedValue([
            aggregate(
                'https://s1.chess-results.com/tnr1.aspx',
                'Goiano Blitz',
                5,
                7,
            ),
        ]);

        const { text } = await render();

        expect(text()).toContain('Goiano Blitz');
        expect(text()).toContain('Round 5 of 7');
    });

    test('shows how long ago the tournament last changed', async () => {
        mockListTournaments.mockResolvedValue([
            aggregate(
                'https://s1.chess-results.com/tnr1.aspx',
                'Goiano Blitz',
                5,
                7,
                new Date(Date.now() - 2 * 60 * 60 * 1000),
            ),
        ]);

        const { text } = await render();

        expect(text()).toContain('2h ago');
    });

    // A stream with no events cannot claim a time, and a "·" dangling off the
    // round reads as a rendering bug.
    test('omits the timestamp when the aggregate has none', async () => {
        mockListTournaments.mockResolvedValue([
            aggregate(
                'https://s1.chess-results.com/tnr1.aspx',
                'Goiano Blitz',
                5,
                7,
                null,
            ),
        ]);

        const { text } = await render();

        expect(text()).toContain('Round 5 of 7');
        expect(text()).not.toContain('Round 5 of 7 ·');
    });

    test('reads round zero as no pairings rather than "0 of 7"', async () => {
        mockListTournaments.mockResolvedValue([
            aggregate(
                'https://s1.chess-results.com/tnr1.aspx',
                'Not started',
                0,
                7,
            ),
        ]);

        const { text } = await render();

        expect(text()).toContain('No pairings yet');
        expect(text()).not.toContain('Round 0');
    });

    // Events written before totalRounds existed replay as 0. Seen on a real
    // device as "Round 5 of 0".
    test('omits the total when it is unknown rather than showing zero', async () => {
        mockListTournaments.mockResolvedValue([
            aggregate('https://s1.chess-results.com/tnr1.aspx', 'Legacy', 5, 0),
        ]);

        const { text } = await render();

        expect(text()).toContain('Round 5');
        expect(text()).not.toContain('of 0');
    });

    test('unregisters and refreshes', async () => {
        const id = 'https://s1.chess-results.com/tnr1.aspx';
        mockListTournaments.mockResolvedValue([
            aggregate(id, 'Goiano Blitz', 5, 7),
        ]);

        const { remove } = await render();

        mockListTournaments.mockResolvedValue([]);
        await remove(id);

        expect(mockUnregisterTournament).toHaveBeenCalledWith(id);
        expect(mockListTournaments).toHaveBeenCalledTimes(2);
    });

    // Registration happens on the other screen, so returning to this one is
    // the only moment a newly added tournament can appear.
    test('refreshes when the screen regains focus', async () => {
        const { focus } = await render();

        await focus();

        expect(mockListTournaments).toHaveBeenCalledTimes(2);
    });

    test('refreshes when a monitoring tick fires', async () => {
        await render();

        await ReactTestRenderer.act(async () => {
            DeviceEventEmitter.emit('onMonitoringTick');
        });

        expect(mockListTournaments).toHaveBeenCalledTimes(2);
    });
});

describe('search bar', () => {
    test('opens the search screen when tapped', async () => {
        const { openSearch, navigate } = await render();

        await openSearch();

        expect(navigate).toHaveBeenCalledWith('Search');
    });
});

describe('notifications toggle', () => {
    test('starts monitoring when switched on', async () => {
        const { toggle, switchIsOn } = await render();

        await toggle(true);

        expect(mockStart).toHaveBeenCalled();
        expect(switchIsOn()).toBe(true);
    });

    test('stops monitoring when switched off', async () => {
        mockIsMonitoring.mockResolvedValue(true);

        const { toggle, switchIsOn } = await render();

        await toggle(false);

        expect(mockStop).toHaveBeenCalled();
        expect(switchIsOn()).toBe(false);
    });

    // Otherwise the toggle sits on while nothing is ever delivered.
    test('returns to off and explains when the permission is denied', async () => {
        mockStart.mockResolvedValue(false);

        const { toggle, switchIsOn, text } = await render();

        await toggle(true);

        expect(switchIsOn()).toBe(false);
        expect(text()).toContain('Notifications are blocked');
    });

    test('reflects monitoring already running at launch', async () => {
        mockIsMonitoring.mockResolvedValue(true);

        const { switchIsOn } = await render();

        expect(switchIsOn()).toBe(true);
    });
});
```

Note the `toggle` helper calls `props.onPress(next)` on the `Pressable`. The custom `Switch` ignores the argument and negates its own `value`, so `toggle(true)` from an off state and `toggle(false)` from an on state both do what they say.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/HomeScreen.test.tsx`
Expected: FAIL — `Cannot find module '../src/ui/screens/HomeScreen.tsx'`

- [ ] **Step 3: Write the screen**

Create `src/ui/screens/HomeScreen.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react';
import {
    DeviceEventEmitter,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell } from 'lucide-react-native';
import { MonitoringController } from '../../monitoring/MonitoringController.ts';
import { tournamentService } from '../../api';
import { SearchBarButton } from '../SearchBarButton.tsx';
import { Switch } from '../Switch.tsx';
import { TournamentCard, TournamentCardModel } from '../TournamentCard.tsx';
import { theme } from '../theme.ts';

const TICK_INTERVAL_SECONDS = 60;

/**
 * The subset of the navigation object this screen uses. Hand-written rather
 * than imported so the screen can be rendered in a test with a plain object.
 */
export interface HomeScreenNavigation {
    navigate: (route: 'Search') => void;
    addListener: (event: 'focus', listener: () => void) => () => void;
}

export function HomeScreen({
    navigation,
}: {
    navigation: HomeScreenNavigation;
}) {
    const safeAreaInsets = useSafeAreaInsets();

    const [tournaments, setTournaments] = useState<TournamentCardModel[]>([]);
    const [monitoring, setMonitoring] = useState(false);
    const [togglingMonitoring, setTogglingMonitoring] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        const tracked = await tournamentService.listTournaments();

        setTournaments(
            tracked.map(tournament => {
                const details = tournament.getDetails();

                return {
                    id: tournament.id,
                    name: details.name,
                    currentRound: details.currentRound,
                    totalRounds: details.totalRounds,
                    updatedAt: tournament.getUpdatedAt(),
                };
            }),
        );
    }, []);

    useEffect(() => {
        // A tick may have advanced a round, so the cards are refreshed rather
        // than left stale until the app restarts.
        const tick = DeviceEventEmitter.addListener('onMonitoringTick', () => {
            refresh();
        });

        // Registering happens on the search screen, so coming back here is the
        // only moment a new tournament can appear.
        const unsubscribeFocus = navigation.addListener('focus', () => {
            refresh();
        });

        MonitoringController.isMonitoring().then(setMonitoring);
        refresh();

        return () => {
            tick.remove();
            unsubscribeFocus();
        };
    }, [navigation, refresh]);

    const toggleMonitoring = async (next: boolean) => {
        setTogglingMonitoring(true);
        setError(null);

        try {
            if (!next) {
                MonitoringController.stop();
                setMonitoring(false);

                return;
            }

            const started = await MonitoringController.start(
                TICK_INTERVAL_SECONDS,
            );

            setMonitoring(started);

            if (!started) {
                setError(
                    'Notifications are blocked for this app. Enable them in ' +
                        'Android settings to get round alerts.',
                );
            }
        } catch (caught) {
            setMonitoring(false);
            setError((caught as Error).message);
        } finally {
            setTogglingMonitoring(false);
        }
    };

    const unregister = async (id: string) => {
        setError(null);

        try {
            await tournamentService.unregisterTournament(id);
            await refresh();
        } catch (caught) {
            setError((caught as Error).message);
        }
    };

    return (
        <View
            style={[styles.container, { paddingTop: safeAreaInsets.top + 16 }]}
        >
            <Text style={styles.title}>Chess Results Notifier</Text>

            <SearchBarButton onPress={() => navigation.navigate('Search')} />

            <View style={styles.toggleRow}>
                <View style={styles.toggleLabel}>
                    <Bell size={18} color={theme.muted} />
                    <Text style={styles.toggleText}>Notifications</Text>
                </View>
                <Switch
                    value={monitoring}
                    onValueChange={toggleMonitoring}
                    disabled={togglingMonitoring}
                    testID="notifications-switch"
                />
            </View>

            {error !== null && <Text style={styles.error}>{error}</Text>}

            <Text style={styles.sectionLabel}>
                TRACKED · {tournaments.length}
            </Text>

            <ScrollView
                style={styles.list}
                contentContainerStyle={styles.listContent}
            >
                {tournaments.length === 0 ? (
                    <Text style={styles.empty}>
                        No tournaments yet. Tap the bar above to add a
                        chess-results link.
                    </Text>
                ) : (
                    tournaments.map(tournament => (
                        <TournamentCard
                            key={tournament.id}
                            tournament={tournament}
                            onUnregister={unregister}
                        />
                    ))
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: theme.background,
    },
    title: {
        color: theme.text,
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 16,
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: theme.card,
        borderColor: theme.border,
        borderWidth: 1,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginTop: 12,
    },
    toggleLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    toggleText: {
        color: theme.text,
        fontSize: 16,
        fontWeight: '500',
    },
    sectionLabel: {
        color: theme.muted,
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 1,
        marginTop: 24,
    },
    list: {
        flex: 1,
        marginTop: 12,
    },
    listContent: {
        paddingBottom: 24,
    },
    empty: {
        color: theme.muted,
        fontSize: 14,
        lineHeight: 20,
    },
    error: {
        marginTop: 12,
        color: theme.danger,
        fontSize: 13,
        lineHeight: 18,
    },
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/HomeScreen.test.tsx`
Expected: PASS, 13 tests

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens/HomeScreen.tsx __tests__/HomeScreen.test.tsx
git commit -m "feat: Add the home screen"
```

---

### Task 10: Wire up navigation and remove what it replaced

**Files:**
- Create: `src/navigation/RootNavigator.tsx`
- Modify: `App.tsx` (full rewrite)
- Modify: `android/app/src/main/java/com/chessresultsnotifier/MainActivity.kt`
- Delete: `src/ui/NotificationsToggle.tsx`, `src/ui/TournamentInput.tsx`, `__tests__/App.test.tsx`

- [ ] **Step 1: Write the navigator**

Create `src/navigation/RootNavigator.tsx`:

```tsx
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../ui/screens/HomeScreen.tsx';
import { SearchScreen } from '../ui/screens/SearchScreen.tsx';
import { theme } from '../ui/theme.ts';

export type RootStackParamList = {
    Home: undefined;
    Search: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Both screens draw their own header, but the container's theme still decides
// the colour behind a transition, which is what stops a white flash.
const navigationTheme = {
    ...DarkTheme,
    colors: {
        ...DarkTheme.colors,
        background: theme.background,
        card: theme.card,
        text: theme.text,
        border: theme.border,
        primary: theme.accent,
    },
};

export function RootNavigator() {
    return (
        <NavigationContainer theme={navigationTheme}>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Home" component={HomeScreen} />
                <Stack.Screen name="Search" component={SearchScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}
```

- [ ] **Step 2: Rewrite App.tsx as a shell**

Replace the entire contents of `App.tsx` with:

```tsx
/**
 * @format
 */

import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator.tsx';

function App() {
    return (
        <SafeAreaProvider>
            {/* No backgroundColor: RN 0.87 dropped it for edge-to-edge. Each
                screen paints behind the status bar via the safe-area inset. */}
            <StatusBar barStyle="light-content" />
            <RootNavigator />
        </SafeAreaProvider>
    );
}

export default App;
```

- [ ] **Step 3: Delete what these replaced**

```bash
git rm src/ui/NotificationsToggle.tsx src/ui/TournamentInput.tsx __tests__/App.test.tsx
```

`App.test.tsx` goes because every case it covered now lives in `HomeScreen.test.tsx` or `SearchScreen.test.tsx`, and it reached for `findByType(Switch)` and `findByType(TextInput)` against components that no longer exist on that screen.

- [ ] **Step 4: Fix the Android activity for react-native-screens**

`react-native-screens` requires the activity to skip Android's fragment state restoration, or the app crashes when it is recreated after being backgrounded.

In `android/app/src/main/java/com/chessresultsnotifier/MainActivity.kt`, add the import below the existing `package` line:

```kotlin
import android.os.Bundle
```

and add this method inside the `MainActivity` class, above `getMainComponentName`:

```kotlin
    /**
     * Passing null discards Android's saved fragment state. react-native-screens
     * requires this: restored fragments would otherwise be reattached to a React
     * tree that no longer exists, and the app crashes on recreation.
     */
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(null)
    }
```

- [ ] **Step 5: Verify the suite and types**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: all tests PASS (`relativeTime`, `tournamentUrl`, `aggregate`, `Switch`, `HomeScreen`, `SearchScreen`, `monitoring`, `scraping`), no type errors, no lint errors.

**If `tsc` reports that `HomeScreen` or `SearchScreen` is not assignable to `Stack.Screen`'s `component` prop:** React Navigation's `navigation` object did not structurally satisfy the narrow interfaces. Do not widen the interfaces — that would drag navigation types into the tests. Instead, in `RootNavigator.tsx`, render through the child-function form and cast at that single boundary:

```tsx
            <Stack.Screen name="Home">
                {props => (
                    <HomeScreen
                        navigation={
                            props.navigation as unknown as HomeScreenNavigation
                        }
                    />
                )}
            </Stack.Screen>
            <Stack.Screen name="Search">
                {props => (
                    <SearchScreen
                        navigation={
                            props.navigation as unknown as SearchScreenNavigation
                        }
                    />
                )}
            </Stack.Screen>
```

importing the two interfaces from their screen modules.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: Navigate between the home and search screens"
```

---

### Task 11: Rebuild and verify on a device

The two native modules mean a Metro reload is not enough.

**Files:** none

- [ ] **Step 1: Rebuild**

```bash
npx react-native run-android
```

Expected: Gradle builds and installs. If it fails on a duplicate or missing native module, run `cd android && ./gradlew clean` and retry.

- [ ] **Step 2: Walk through the app and confirm each change**

- [ ] The notifications switch is the custom pill, not the Material switch, and animates over ~200ms when tapped
- [ ] Tapping the home search bar pushes the search screen; the keyboard opens by itself
- [ ] The Android back button returns to home
- [ ] Pasting a tournament URL shows the "Track this tournament" row; tapping it returns home with the tournament in the list
- [ ] Typing a player name shows "Player search is coming soon" in muted grey, not red
- [ ] A bad chess-results URL shows the error on the search screen and stays there
- [ ] Each card shows a trash icon instead of "Remove", and tapping it removes the tournament
- [ ] Each card's meta line reads `Round N of M · <time> ago`
- [ ] Background the app, wait, and reopen it — no crash from fragment restoration (this is what Task 10 Step 4 guards)

- [ ] **Step 3: Commit anything the walkthrough forced**

```bash
git add -A
git commit -m "fix: <what the device walkthrough turned up>"
```

If the walkthrough was clean, skip this step.

---

## Notes for the reviewer

- **`updatedAt` is last-*changed*, not last-*checked*.** A card can read "3d ago" while monitoring is polling every 60 seconds. This is deliberate and argued in the spec; do not "fix" it by adding a write on every tick.
- **The screens' `navigation` props are hand-written interfaces.** That is what keeps the tests free of a navigation container. Keep them narrow.
- **Only `lucide-react-native` is mocked, not four packages.** The spec anticipated Jest mocks for `react-native-screens`, `react-native-svg` and the navigation container too. Rendering the screens directly with a stub `navigation` object made all three unnecessary. This is a deviation from the spec's testing section, in the direction of less machinery.
- **`__tests__/App.test.tsx` is gone on purpose,** replaced by `HomeScreen.test.tsx` and `SearchScreen.test.tsx`. Check that every case it held has a counterpart before approving Task 10.
