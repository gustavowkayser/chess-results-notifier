/**
 * The backend this build talks to.
 *
 * The publishable key is meant to ship inside the app — it identifies the
 * project and nothing else. What protects the data is row level security, which
 * grants clients SELECT on their own rows and no way to write at all. The
 * secret key never appears in this repository.
 */
export const SUPABASE_URL = 'https://vkfmsoxorqugicevsmbd.supabase.co';

export const SUPABASE_PUBLISHABLE_KEY =
    'sb_publishable_rFa4ZGAY3Kq-coqg6yITzA_YOae_vjC';
