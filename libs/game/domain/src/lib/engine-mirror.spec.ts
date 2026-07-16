import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The Edge Functions run the game engine in Deno via a mirrored copy under
// apps/backend/supabase/functions/_shared. If that copy drifts from this
// source, the server and client would validate moves differently — a security
// and correctness hazard. These tests fail the build on any drift.

const SOURCE_DIR = join('libs', 'game', 'domain', 'src', 'lib');
const MIRROR_DIR = join('apps', 'backend', 'supabase', 'functions', '_shared');

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n');
}

function stripMirrorHeader(contents: string): string {
  // Remove the leading "// AUTO-MIRRORED ..." banner up to its blank line.
  return contents.replace(/^\/\/ AUTO-MIRRORED[\s\S]*?Deno requires\.\n\n/, '');
}

describe('shared engine mirror stays in sync with game-domain', () => {
  it('game-domain.ts is a byte-for-byte mirror', () => {
    const source = read(join(SOURCE_DIR, 'game-domain.ts'));
    const mirror = stripMirrorHeader(read(join(MIRROR_DIR, 'game-domain.ts')));
    expect(mirror).toBe(source);
  });

  it('game-engine.ts differs only by the Deno .ts import extension', () => {
    const source = read(join(SOURCE_DIR, 'game-engine.ts'));
    const mirror = stripMirrorHeader(read(join(MIRROR_DIR, 'game-engine.ts')))
      // Deno requires explicit .ts extensions on relative imports.
      .replace("from './game-domain.ts'", "from './game-domain'");
    expect(mirror).toBe(source);
  });
});
