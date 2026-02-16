import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    // During build/SSR prerendering, env vars may not be set.
    // Return a minimal proxy that won't crash but won't do anything.
    if (typeof window === "undefined") {
      return new Proxy({} as ReturnType<typeof createBrowserClient>, {
        get: () => () => ({ data: null, error: null, count: null }),
      });
    }
    throw new Error(
      "Missing Supabase environment variables. Copy .env.local.example to .env.local and fill in your credentials."
    );
  }

  client = createBrowserClient(url, key);
  return client;
}
