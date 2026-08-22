-- Every table is read-only to clients. The only writes are the Edge Functions,
-- which connect as service_role and bypass RLS, and public.claim_pending_rounds
-- below, which is SECURITY DEFINER. So there is deliberately no INSERT, UPDATE
-- or DELETE policy anywhere in this file: a leaked anon key buys a read of
-- public tournament data and nothing else.

ALTER TABLE public.events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- New objects in `public` are not reachable through the Data API roles without
-- this, so the grants are as load-bearing as the policies.
GRANT SELECT ON public.events, public.tournaments, public.subscriptions
    TO authenticated;

GRANT ALL ON public.events, public.tournaments, public.subscriptions
    TO service_role;

-- Tournament facts are public information reprinted from chess-results; there
-- is nothing here to scope to one user.
CREATE POLICY tournaments_read ON public.tournaments
    FOR SELECT TO authenticated
    USING (TRUE);

CREATE POLICY subscriptions_read ON public.subscriptions
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);

-- Clients do not replay streams today — they read the projections. The log is
-- exposed anyway so a history view can be built without another migration, on
-- the same terms: shared events are shared, yours are yours.
CREATE POLICY events_read ON public.events
    FOR SELECT TO authenticated
    USING (
        aggregate_type = 'tournament'
        OR (SELECT auth.uid()) = user_id
    );
