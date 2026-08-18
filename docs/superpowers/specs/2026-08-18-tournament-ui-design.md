# Tournament UI and Unregistering

Date: 2026-08-18
Status: Approved

## Goal

Replace the development harness screen with the real UI: a notifications
toggle, the tournament URL input, and a card per tracked tournament with an
unregister button, on a dark theme.

## The part that is not UI

Three of the four requirements are presentation. Unregistering is not: nothing
in the backend can remove a tournament. `EventRepository` exposes only `save`,
`load` and `listAggregateIds`, and `SqliteEventRepository` is append-only by
design — "Rows are never updated or deleted".

Unregistering is therefore a domain event, not a delete. The README's stated
reason for event sourcing is that "history and auditing could be crucial", and a
hard delete discards exactly what that architecture exists to preserve.

## Domain

`TournamentUnregistered` is a new event with an empty payload.

`Tournament` gains:

- `unregister()` — applies the event, and is a no-op when already unregistered
- `isUnregistered()`

`mutate` sets the flag on `TournamentUnregistered` and clears it on
`TournamentRegistered`, so re-registering a URL revives the existing stream
rather than starting a new one. Replay reads
`Registered -> Unregistered -> Registered`, which is the history worth keeping.

`DomainEventSerializer` gains the matching factory.

## Application

- `TournamentService.unregisterTournament(url)` — canonicalize, rehydrate,
  apply, save.
- `TournamentService.listTournaments()` — filters unregistered aggregates out.
- `MonitoringService.check()` — returns early for an unregistered tournament, so
  removed tournaments stop being fetched from chess-results.

`MonitoringController.start()` changes from `Promise<void>` to
`Promise<boolean>`, returning `false` when the Android 13+ notification
permission is denied. It already requested the permission and discarded the
answer, which is how a toggle ends up reading "on" while nothing is delivered.

## UI

```
App.tsx                       shell, state, wiring
src/ui/theme.ts               palette
src/ui/NotificationsToggle.tsx
src/ui/TournamentInput.tsx
src/ui/TournamentCard.tsx
```

`App.tsx` was already around 200 lines and this roughly doubles it, so the
pieces move out.

Layout, top to bottom: toggle, input, cards.

Cards load on mount and refresh after registering, after unregistering, and on
`onMonitoringTick`. That listener already exists, so a card whose round advances
updates itself instead of going stale until the app restarts.

Registration keeps the pending and error handling added with the input. Errors
appear inline beneath the field rather than in a log. The empty state tells the
user to paste a URL.

### Palette

```
background #12141a   card #1c1f27   border #2b303b
text #e6e8ec         muted #9aa3b2
accent #4f8cc9       danger #c9524d
```

`StatusBar` becomes `light-content`. This replaces the light-only styles
throughout, including the white `TextInput` added with the input field — a
stopgap that existed only because there was no theme to style against.

## Testing

Domain and service: an unregistered tournament drops out of `listTournaments`,
stops being polled by `checkAll`, and re-registering revives it. Unregistering
twice appends one event.

Component: toggling calls start and stop, a denied permission returns the toggle
to off, cards render the name and `round N of M`, and unregister calls through.

## Out of scope

Navigation and multiple screens. This remains one screen.
