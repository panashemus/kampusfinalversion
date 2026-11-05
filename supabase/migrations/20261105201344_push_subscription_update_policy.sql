-- Allow an authenticated student to refresh their own endpoint encryption keys.
-- Existing SELECT/INSERT/DELETE policies remain unchanged.
DROP POLICY IF EXISTS push_subs_update_own ON public.push_subscriptions;
CREATE POLICY push_subs_update_own ON public.push_subscriptions FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);