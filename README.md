# About the Project

Chess Notify is a simple mobile app for Android that notifies users about the matchmaking of a chess
tournament. This is intended for chess players that want to keep track of the game.

## Functionalities

The user can register a chess-results link for the tournament he wants to keep track of. He can choose two types of
notifications:

- Round pairing
- Round pairing with player tracking

## Chess Results Scraping

**Base URL**: ```https://sx.chess-results.com/tournament_id```

For the scraping, we need to specify the server (e.g. ```https://s1...```, ```https://s2...``` or ```https://s3...```)
The tournament ID follows a rule. It starts with ```tnr``` and ends with ```.aspx```

With the **Base URL** we can get the tournament details with a simple scraping. Here are the query params that we're
gonna use.

```lan```: It's the query parameter for the language of the page. This is helpful for getting details right.

```art```: I don't know what this actually means. But with this you can control the pairing round category

```rd```: This the round number

## Architecture

For this project it makes sense to go with Event Sourcing since history and auditing could be crucial.

The scraping runs on Supabase rather than on the phones. Each device used to poll
chess-results itself, which cost one request per tournament *per user* every
minute — 200 people following the same open meant 200 requests a minute for one
page. Now a scheduled job scrapes each tournament once and every follower reads
the result, so the load on chess-results scales with tournaments and not with
users.

```
pg_cron (every minute)
  -> refresh-tournaments      scrapes tournaments with at least one follower,
                              appends RoundPublished when a round moves on

app (search screen)
  -> register-tournament      scrapes only if nobody has followed it before,
     unregister-tournament    then records this user's subscription

app (60s tick)
  -> claim_pending_rounds()   rounds this user has not been told about yet,
                              claimed and shown as a local notification
```

The event log is the source of truth. Two kinds of stream share it: a `tournament`
stream per tournament, shared and written only by the refresh job, and a
`subscription` stream per user per tournament. `tournaments` and `subscriptions`
are projections, kept in step by a trigger so an append and its projection land
in one transaction.

### Layout

| Path | What lives there |
| --- | --- |
| `src/` | The React Native app. Holds no domain state of its own any more. |
| `supabase/migrations/` | Schema, projections, RLS, the two RPCs, the cron job. |
| `supabase/functions/_shared/` | Domain, application and scraping code. Plain TypeScript — Jest and Metro compile it too, which is why the app imports `ChessResultsUrl` from here rather than keeping a second copy. |
| `supabase/functions/_shared/edge/` | The Deno-only adapters. Excluded from the app's tsconfig. |

### Running it

```bash
npm test                  # domain, scraping and screens
npx supabase start        # needs docker
npx supabase db reset     # applies every migration from scratch
npx supabase functions serve
```

Deploying needs `supabase db push`, `supabase functions deploy`, anonymous
sign-ins enabled on the project, and the two Vault secrets the cron migration
documents.
