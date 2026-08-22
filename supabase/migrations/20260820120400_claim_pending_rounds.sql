-- What a monitoring tick calls. Returns the tournaments whose round has moved
-- on since this user was last told, and marks them told in the same statement.
--
-- Claim and read are one statement on purpose. Two overlapping ticks — the
-- foreground service and a cold headless task can both be in flight — would
-- otherwise each see the same round and notify twice.

CREATE FUNCTION public.claim_pending_rounds()
    RETURNS TABLE (
        tournament_url TEXT,
        name           TEXT,
        current_round  INTEGER,
        total_rounds   INTEGER
    )
    LANGUAGE sql
    SECURITY DEFINER
    SET search_path = ''
AS $$
    UPDATE public.subscriptions s
       SET last_notified_round = t.current_round
      FROM public.tournaments t
     WHERE s.tournament_url = t.url
       AND s.user_id        = (SELECT auth.uid())
       AND s.active
       AND t.current_round  > s.last_notified_round
    RETURNING s.tournament_url, t.name, t.current_round, t.total_rounds;
$$;

COMMENT ON FUNCTION public.claim_pending_rounds() IS
    'Rounds this user has not been notified about yet. Calling it twice in a '
    'row returns nothing the second time.';

-- SECURITY DEFINER plus the default grant to PUBLIC would let an unauthenticated
-- caller in. It would see nothing (auth.uid() is null), but the door should not
-- be open in the first place.
REVOKE EXECUTE ON FUNCTION public.claim_pending_rounds() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.claim_pending_rounds() TO authenticated;
