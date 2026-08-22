-- Projections of the event log. Derived state only: dropping and rebuilding
-- these from public.events must produce the same rows.

CREATE TABLE public.tournaments (
    url             TEXT PRIMARY KEY,
    name            TEXT        NOT NULL,
    current_round   INTEGER     NOT NULL DEFAULT 0,
    total_rounds    INTEGER     NOT NULL DEFAULT 0,

    -- The newest event on this stream. "Last change", not "last checked": a
    -- refresh that sees no new round writes no event by design.
    updated_at      TIMESTAMPTZ NOT NULL,

    -- When the scraper last reached the page, successfully or not. Deliberately
    -- not an event: it says nothing about the tournament, only about us, and it
    -- is what the refresh job orders by to spread its work out.
    last_checked_at TIMESTAMPTZ
);

COMMENT ON COLUMN public.tournaments.url IS
    'The canonical chess-results address — see ChessResultsUrl.canonical().';

CREATE TABLE public.subscriptions (
    user_id             UUID        NOT NULL
                            REFERENCES auth.users (id) ON DELETE CASCADE,
    tournament_url      TEXT        NOT NULL
                            REFERENCES public.tournaments (url) ON DELETE CASCADE,
    active              BOOLEAN     NOT NULL DEFAULT TRUE,

    -- The highest round this user has already been told about. Seeded from the
    -- tournament's current round at registration, so following a tournament
    -- that is already on round 5 does not immediately announce round 5.
    last_notified_round INTEGER     NOT NULL DEFAULT 0,

    created_at          TIMESTAMPTZ NOT NULL,

    PRIMARY KEY (user_id, tournament_url)
);

-- What the refresh job asks for: the tournaments somebody is still following.
CREATE INDEX subscriptions_active_idx
    ON public.subscriptions (tournament_url)
    WHERE active;
