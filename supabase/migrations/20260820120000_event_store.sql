-- The append-only event store. Mirrors the on-device SQLite schema that used to
-- hold it (src/api/infrastructure/sqlite/migrations.ts), with two additions the
-- move to a shared server forces:
--
--   aggregate_type  two kinds of stream now live side by side — the shared
--                   'tournament' stream that the scraper writes, and the
--                   per-user 'subscription' stream that records who follows what
--   user_id         who a subscription stream belongs to, so RLS has something
--                   to key on without parsing aggregate_id
--
-- Rows are never updated or deleted: an aggregate is rebuilt by replaying its
-- stream in `sequence` order.

CREATE TABLE public.events (
    sequence       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    aggregate_type TEXT        NOT NULL,
    aggregate_id   TEXT        NOT NULL,
    user_id        UUID        REFERENCES auth.users (id) ON DELETE CASCADE,
    type           TEXT        NOT NULL,
    occurred_at    TIMESTAMPTZ NOT NULL,
    payload        JSONB       NOT NULL DEFAULT '{}'::JSONB,

    CONSTRAINT events_aggregate_type_known
        CHECK (aggregate_type IN ('tournament', 'subscription')),

    -- Subscription events belong to someone; tournament events belong to
    -- nobody. Writing one without the other is a bug, not a variation.
    CONSTRAINT events_owner
        CHECK ((aggregate_type = 'subscription') = (user_id IS NOT NULL))
);

COMMENT ON TABLE public.events IS
    'Append-only domain event log. Never updated or deleted.';

-- Replaying one stream is the hot path: every write rehydrates its aggregate
-- first.
CREATE INDEX events_stream_idx
    ON public.events (aggregate_type, aggregate_id, sequence);
