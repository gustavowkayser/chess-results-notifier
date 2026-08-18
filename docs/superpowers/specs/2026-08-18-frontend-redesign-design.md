# Frontend Redesign: Navigation, Search Screen, Custom Controls

Date: 2026-08-18
Status: Approved

## Goal

Lift the UI above stock-Android defaults and give the app somewhere to grow.
Four changes, one of which reaches into the domain:

- A custom animated switch, replacing React Native's `Switch`.
- A search bar on the home screen that opens a dedicated search screen, used
  today to paste a tournament URL and later to search for players.
- An icon in place of the `Remove` text button on the tournament card.
- A relative timestamp on the tournament card.

## Decisions

Three choices were settled before designing, and each closed off work that
looked reasonable but was not:

**Real navigation, not a state-swapped overlay.** The app is expected to grow
player search results and likely a tournament detail screen, and each of those
wants a back stack. `@react-navigation/native-stack` costs a native rebuild
once; hand-rolled screen state costs a rewrite the moment the third screen
arrives.

**One input, sniffed by content — not a mode switch.** A segmented
"Tournament / Player" control would be half dead UI until player search exists,
and an empty tab reads as broken. A single field that recognises a
chess-results URL registers it; anything else lands on a "coming soon" state.
The screen's layout — bar pinned top, results below — is already the shape
player search needs, so adding it later is filling in a region, not a redesign.

**`updatedAt` means "last time the data changed", not "last time we checked".**
Last-checked is what users probably read the word as, but it is not recorded
anywhere, and it must not go in the event store: a monitoring tick that sees no
change deliberately writes no event, and appending one every 60 seconds would
add roughly 1,400 junk rows per tournament per day to an append-only log whose
entire purpose is to be worth replaying. Recording it properly needs a separate
mutable table — mutable state sitting next to an event store — to answer a
question the notifications toggle already answers.

Last-changed, by contrast, is free. The timestamps are already in the store.

## Dependencies

```
@react-navigation/native        ^7.3
@react-navigation/native-stack  ^7.18
react-native-screens            ^4.27
react-native-svg                ^15.15
lucide-react-native             ^1.32
```

`react-native-safe-area-context ^5.5` is already a dependency.

`react-native-screens` and `react-native-svg` are native modules, so this
requires one `npx react-native run-android` rebuild — a Metro reload will not
pick them up. Lucide 1.32 peers on `react-native-svg ^12 || ^13 || ^14 || ^15`,
so 15.15 satisfies it.

## Navigation

`App.tsx` becomes a shell and nothing else:

```
SafeAreaProvider
  StatusBar (light-content)
  NavigationContainer (dark theme)
    RootNavigator
```

`src/navigation/RootNavigator.tsx` declares a native stack with headers hidden —
both screens draw their own — and two routes, `Home` and `Search`.

### No shared state container

`SearchScreen` calls `tournamentService.registerTournament` itself and
`goBack()`s on success. `HomeScreen` refreshes on mount, on the existing
`onMonitoringTick` event, and on `useFocusEffect`.

A `TournamentsContext` was considered and rejected. The only thing genuinely
shared between the screens is the fact that the list changed, and focus already
signals that. Error state stays local to the screen that produced it.

## Screens

```
HOME                                  SEARCH
┌────────────────────────────┐        ┌────────────────────────────┐
│ Chess Results Notifier     │        │ [←] [🔍 paste a link…  ][✕]│
│ ┌────────────────────────┐ │        │ ──────────────────────────  │
│ │ 🔍  Add or search…     │ │──tap──▶│                            │
│ └────────────────────────┘ │        │   (feedback area)          │
│ ┌────────────────────────┐ │        │                            │
│ │ 🔔 Notifications  (●══)│ │        │   idle  → what to paste    │
│ └────────────────────────┘ │        │   busy  → "Fetching…"      │
│ TRACKED · 2                │        │   error → inline, danger   │
│ ┌────────────────────────┐ │        │   text  → "Player search   │
│ │ Goiano Blitz      [🗑] │ │        │            coming soon"    │
│ │ Round 5 of 7 · 2h ago  │ │        │                            │
│ └────────────────────────┘ │        └────────────────────────────┘
└────────────────────────────┘
```

`HomeScreen` (`src/ui/screens/HomeScreen.tsx`) owns the tournament list and the
monitoring toggle. Its search bar is a `Pressable`, not a `TextInput`, so no
keyboard opens on home.

`SearchScreen` (`src/ui/screens/SearchScreen.tsx`) owns the query, the pending
flag and the error. The field autofocuses on mount and uses
`returnKeyType="go"`.

### Sniffing the input

`ChessResultsUrl.parse` throws on a non-match, which is right for the service
and wrong for a field being typed into. `ChessResultsUrl` gains a static
`isTournamentUrl(text): boolean` that tests the existing regex without
throwing, re-exported from `src/api/index.ts`.

The UI does not grow a second copy of that regex.

A match registers the tournament. A non-match shows the "player search coming
soon" state, which is a *state* and not an error — a half-typed URL must not
flash red.

## Components

**`src/ui/Switch.tsx`** replaces React Native's `Switch`, which renders the
stock Material control on Android. `Pressable` driving an `Animated.Value` over
200ms: a 52×32 track, a 26px thumb, `translateX` from 0 to 20, and a track
colour interpolating `border` → `accent`. `opacity: 0.5` while busy. Carries
`accessibilityRole="switch"` and a `testID`.

**`src/ui/SearchBarButton.tsx`** is the home-screen bar: a `Search` icon and
placeholder text, styled identically to the real field on the search screen, so
tapping it reads as the bar becoming editable.

**`TournamentCard`** swaps the `Remove` label for `Trash2` at 18px in
`theme.danger`, inside a 40×40 tap target with hit slop. The existing
`unregister-<id>` testID is unchanged. The meta line becomes
`Round 5 of 7 · 2h ago`, and the list gains a `TRACKED · N` section header
above the cards.

**`src/ui/relativeTime.ts`** exports a pure
`formatRelativeTime(date, now = new Date())`: `just now` under a minute, then
`5m ago`, `2h ago`, `3d ago`, and a locale date beyond a week. Being pure, it is
tested directly instead of by mocking a clock inside a component test.

Icons used: `Search`, `Trash2`, `Bell`, `ArrowLeft`, `X`.

## Domain: `updatedAt`

`AggregateRoot` gains a private `updatedAt: Date | null` and a public
`getUpdatedAt()`. `apply` and `replay` both route through a single private
`mutateAndTrack(event)`, which calls `mutate` and then records
`event.occurredAt`. Routing both paths through one method is what keeps a
rehydrated aggregate from disagreeing with a freshly mutated one.

No migration and no schema change: `occurred_at` is already a column, and
`DomainEventSerializer.deserialize` already restores it into each event, so
existing stored streams report the right timestamp on first launch.

`TournamentDetails` is deliberately left alone. It doubles as the provider's
scrape result via `TournamentDetailsDTO.toDomain()`, and a scrape has no
timestamp; adding `updatedAt` there would force a fabricated value at that
boundary. `HomeScreen` reads `tournament.getUpdatedAt()` alongside
`getDetails()` when building its card model.

Consequence, accepted: a card reads `2d ago` between rounds even though
monitoring checked a minute ago. The timestamp is attached to the round for
that reason — "this round went up 2 days ago" is both true and the thing a
player cares about.

## Theme

`src/ui/theme.ts` gains only what the new controls need: a `surface` token for
the elevated search bar and a `switchTrackOff` token. The palette is otherwise
unchanged.

## Testing

- `relativeTime.test.ts` — pure, exhaustive on the unit boundaries.
- Domain — a rehydrated aggregate reports its last event's `occurredAt`; a
  freshly registered one reports the registration time.
- `ChessResultsUrl.isTournamentUrl` — accepts the mirrors and rejects prose.
- `HomeScreen.test.tsx` and `SearchScreen.test.tsx`, split out of the existing
  `App.test.tsx`.

`__tests__/App.test.tsx` is rewritten, not patched. It reaches for React
Native internals with `findByType(Switch)` and `findByType(TextInput)`, and
both move — the switch is replaced outright and the input relocates to another
screen. Queries move to `testID`. This is the least glamorous part of the
change and the most likely to take longer than expected.

Jest needs mocks for `react-native-screens`, `react-native-svg`,
`lucide-react-native`, and the navigation container.

## Out of scope

Player search results. A tournament detail screen. A light theme. Reordering or
pinning tournaments.
