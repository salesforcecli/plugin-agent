#!/usr/bin/env node
/*
 * NUTs preflight: verify the compiled oclif command tree is present, and self-heal if not.
 *
 * Why this exists
 * ---------------
 * On CI the shared reusable workflow (salesforcecli/github-workflows .../nut.yml) runs
 * `yarn compile` then `yarn oclif manifest` exactly ONCE, before a `nick-fields/retry`
 * block that re-runs only the NUT command. `yarn compile` is wireit-cached and, on the
 * GitHub Actions runner, wireit restores `lib/` from the GitHub Actions cache instead of
 * running tsc. When that per-job restore is incomplete, `lib/commands` is empty at manifest
 * time, so `oclif manifest` writes a ZERO-command manifest but still prints "wrote manifest"
 * with no error. Every `agent:*` NUT then fails with `command agent:... not found` (oclif
 * exit 2) at command-resolution time, and because the retry block never rebuilds, all retry
 * attempts fail identically.
 *
 * What this does
 * --------------
 * Run this at the front of each `test:nuts:*` script (inside the retried command). In the
 * healthy common case it is a sub-second check and a no-op, so the fast cached build is
 * preserved. If the command tree is empty, it forces a real, un-cached compile
 * (`WIREIT_CACHE=none yarn compile`), regenerates the manifest, and re-verifies — turning a
 * silent 404 into either a heal (so the next retry attempt runs against a correct `lib/`) or
 * a loud, obvious build failure.
 */

import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const manifestPath = join(root, 'oclif.manifest.json');
const commandsDir = join(root, 'lib', 'commands');
const LOG = '[nuts:preflight]';

/** @returns {{ok: boolean, commandCount: number, libCommandEntries: number}} */
function inspect() {
  let commandCount = 0;
  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      commandCount = Object.keys(manifest.commands ?? {}).length;
    } catch {
      commandCount = 0; // unreadable/corrupt manifest counts as unhealthy
    }
  }
  const libCommandEntries = existsSync(commandsDir) ? readdirSync(commandsDir).length : 0;
  return { ok: commandCount > 0 && libCommandEntries > 0, commandCount, libCommandEntries };
}

function run(command, extraEnv = {}) {
  console.error(`${LOG} running: ${command}`);
  execSync(command, { stdio: 'inherit', cwd: root, env: { ...process.env, ...extraEnv } });
}

const before = inspect();
if (before.ok) {
  console.error(
    `${LOG} ok: manifest commands=${before.commandCount}, lib/commands entries=${before.libCommandEntries}`
  );
  process.exit(0);
}

console.error(
  `${LOG} empty command tree (manifest commands=${before.commandCount}, lib/commands entries=${before.libCommandEntries}) — ` +
    'wireit cache restore was likely incomplete; forcing a clean rebuild'
);

try {
  run('yarn compile', { WIREIT_CACHE: 'none' });
  run('yarn oclif manifest');
} catch (err) {
  console.error(`${LOG} rebuild command failed:`, err instanceof Error ? err.message : err);
  process.exit(1);
}

const after = inspect();
if (!after.ok) {
  console.error(
    `${LOG} still empty after clean rebuild (manifest commands=${after.commandCount}, ` +
      `lib/commands entries=${after.libCommandEntries}) — failing so this does not pass silently`
  );
  process.exit(1);
}

console.error(
  `${LOG} healed: manifest commands=${after.commandCount}, lib/commands entries=${after.libCommandEntries}`
);
process.exit(0);
