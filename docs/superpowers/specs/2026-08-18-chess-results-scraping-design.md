# chess-results Scraping

Date: 2026-08-18
Status: Approved

## Goal

Replace the mock `ChessResultsProvider` — which advances the round on every
poll — with real scraping of chess-results.com, and report the total number of
rounds alongside the current one.

## Findings from live pages

Nine tournaments were fetched across six languages. What the pages actually
contain:

| Signal | Location | Notes |
| --- | --- | --- |
| Tournament name | first `<h2>` | identical in every language; contains HTML entities |
| Published rounds | `a[href*="art=2"]`, each with `rd=N` | href structure is language-independent |
| Total rounds | `/N` suffix on the last such link's text | the only value read from text |
| Nothing published | no `art=2` links at all | 5 of the 9 sampled were in this state |

Encoding is genuine UTF-8, verified at byte level (`c3a7` = ç).

### The round label is translated

An early assumption that `Rd.N/M` was language-independent proved wrong:

| `lan` | last two labels |
| --- | --- |
| 1 (EN) | `Rd.4`, `Rd.5/7` |
| 11 (RU) | `Тур4`, `Тур5/7` |
| 33 (ZH) | `4 轮`, `5 轮/7` |
| 19 (EL) | `Γύ.4`, `Γύ.5/7` |
| 35 (AR) | `ج. 4`, `ج. 5 /7` |
| 22 (JA) | `R.4`, `R.5/7` |

Any parser keyed on the string `"Rd."` breaks as soon as a user selects another
language. The href and the link count stay constant, so the round number is read
from the URL rather than the label.

## Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| HTML parsing | `node-html-parser` | Pure JS (deps `entities`, `css-select`), no Node built-ins, so Metro bundles it. `entities` also decodes the entity-heavy tournament names. Robust enough to reuse when player tracking needs pairing tables. |
| Current round | max `rd=` across `art=2` hrefs | Language-proof; no text parsing. |
| Total rounds | `/N` in the last label | Only text-dependent value; the digit-after-slash pattern held in all six languages. |
| Language | constructor default, `lan=1` | Parsing does not depend on it, so exposing it as a user preference later cannot break scraping. |

## Architecture

```
src/api/infrastructure/chessresults/
  ChessResultsUrl.ts          parse + rebuild tournament URLs
  TournamentPageParser.ts     HTML string -> TournamentDetailsDTO
src/api/infrastructure/
  ChessResultsProvider.ts     fetch, then delegate to the parser

__tests__/fixtures/           real saved pages
test-support/StubTournamentProvider.ts
```

`TournamentPageParser` takes a string and returns a DTO. It performs no I/O, so
the scraping rules — the part most likely to break when chess-results changes —
are testable against saved HTML.

`ChessResultsUrl` rebuilds the fetch URL as
`<server>/tnr<id>.aspx?lan=<language>&SNode=S0`, preserving whichever `s1`/`s2`/
`s3` mirror the user registered.

### Parsing rules

| Field | Rule |
| --- | --- |
| `name` | first `<h2>` text, entity-decoded, whitespace collapsed |
| `currentRound` | max `rd=` across `a[href*="art=2"]`; `0` when there are none |
| `totalRounds` | last `/N` in the final anchor's text; falls back to `currentRound` |

### Aggregate id normalization

`Tournament.idFor` uses the registered URL as the aggregate id, so
`tnr1477210.aspx` and `tnr1477210.aspx?lan=10` currently create two separate
aggregates tracking one tournament. `registerTournament` normalizes to
`<server>/tnr<id>.aspx` before registering.

### Domain change

`TournamentDetails` and `TournamentDetailsDTO` gain `totalRounds`.

`TournamentRegistered` carries it for the initial state, and `RoundPublished`
carries it too, so an organiser changing the round count stays reflected in
replayed state.

`DomainEventSerializer` must tolerate its absence: events already written on the
emulator have no `totalRounds`, so deserialization falls back to `0` rather than
throwing.

## Error handling

- Non-200 response: throw, including the status code.
- Missing `<h2>`: throw — the page shape changed, or the tournament does not
  exist.
- `MonitoringService.checkAll` already isolates failures per tournament, so one
  unreachable tournament does not stop a tick.
- `registerTournament` lets errors propagate: registering a bad URL should fail
  loudly at the caller.

Requests send an explicit browser `User-Agent`. Every fetch during research used
one and returned 200; RN's default UA is untested against this host.

## Testing

`monitoring.test.ts` constructs `new ChessResultsProvider()` and depends on the
mock advancing a round per poll. Once the provider performs real HTTP those
tests would hit the network, so the mock's behaviour moves to
`test-support/StubTournamentProvider.ts` and the existing tests use that.

Parser tests run against fixtures saved from the live pages:

- no rounds published
- `Rd.5/7` (in progress)
- `Rd.9/9` (finished)
- the Russian page, which is the regression guard for the language requirement —
  it fails against any `"Rd."`-based parser

No test performs network I/O.

## Out of scope

Player tracking (README's second notification type) needs the `art=2&rd=N`
pairing tables, a second fetch, and its own domain model. It gets its own cycle.
