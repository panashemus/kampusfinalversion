import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Next.js exposes NEXT_PUBLIC_* env vars to the client. The project's .env
// already defines NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Minimal mock client so the UI keeps rendering during local dev when the
// backend env vars are absent. Every method resolves to an empty/no-op result.
function createMockClient(): SupabaseClient {
  const noopAsync = () =>
    Promise.resolve({ data: null, error: null, count: null, status: 0, statusText: '' });

  const mockQueryBuilder: any = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === 'then') return undefined; // not a thenable
        return (..._args: unknown[]) => mockQueryBuilder;
      },
    }
  );

  const mockAuth = {
    getSession: noopAsync,
    onAuthStateChange: () => ({ subscription: { unsubscribe: () => {} } }),
    signInWithPassword: noopAsync,
    signUp: noopAsync,
    signOut: noopAsync,
  };

  const mockChannel = {
    on: () => mockChannel,
    subscribe: () => mockChannel,
    unsubscribe: () => {},
  };

  const mockClient = {
    from: () => mockQueryBuilder,
    auth: mockAuth,
    channel: () => mockChannel,
    removeChannel: () => {},
  };

  return mockClient as unknown as SupabaseClient;
}

let client: SupabaseClient;

if (supabaseUrl && supabaseAnonKey) {
  client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
} else {
  // eslint-disable-next-line no-console
  console.warn(
    '[kampus] Supabase env vars missing (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY). ' +
      'Using a mock client — data will not persist. Set the vars in .env to enable the backend.'
  );
  client = createMockClient();
}

export const supabase = client;
