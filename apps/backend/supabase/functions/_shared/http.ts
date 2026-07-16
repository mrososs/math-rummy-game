// HTTP helpers shared by the authoritative Edge Functions.

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** A rejection that maps to a specific HTTP status and stable error code. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code = 'BAD_REQUEST',
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return jsonResponse({ error: error.message, code: error.code }, error.status);
  }
  // ZodError from body parsing (avoid importing zod here).
  if (
    error &&
    typeof error === 'object' &&
    (error as { name?: string }).name === 'ZodError'
  ) {
    const issues =
      (error as { issues?: Array<{ path?: unknown[]; message?: string }> })
        .issues ?? [];
    const first = issues[0];
    const path = Array.isArray(first?.path) ? first?.path.join('.') : 'body';
    return jsonResponse(
      {
        error: `Invalid request (${path || 'body'}): ${first?.message ?? 'malformed payload'}.`,
        code: 'INVALID_REQUEST',
      },
      400,
    );
  }
  const message =
    error instanceof Error ? error.message : 'Unexpected server error.';
  return jsonResponse({ error: message, code: 'INTERNAL' }, 500);
}

/** Handle CORS preflight; returns a Response for OPTIONS, otherwise null. */
export function handlePreflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}

export async function readJson<T = unknown>(req: Request): Promise<T> {
  if (req.method !== 'POST') {
    throw new HttpError(405, 'Method not allowed.', 'METHOD_NOT_ALLOWED');
  }
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON.', 'BAD_JSON');
  }
}
