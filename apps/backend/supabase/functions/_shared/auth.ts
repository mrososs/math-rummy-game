// Resolves the authenticated user from the request's bearer token.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { HttpError } from './http.ts';

export async function requireUserId(req: Request): Promise<string> {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    throw new HttpError(401, 'A signed-in session is required.', 'UNAUTHENTICATED');
  }

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anonKey) {
    throw new HttpError(500, 'Server auth is misconfigured.', 'CONFIG');
  }

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authHeader } },
  });

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    throw new HttpError(401, 'Your session is invalid or expired.', 'UNAUTHENTICATED');
  }
  return data.user.id;
}
