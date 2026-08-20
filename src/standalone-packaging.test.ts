import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Packaging invariants for a STANDALONE published package (WI-39039, WI-39951).
 *
 * This repo has no npm workspaces and no monorepo root: every dependency it declares must be
 * resolvable from the public registry, and every type package its tsconfig names must actually
 * be declared. Both invariants were violated at once on 2026-08-18 — `@papercusp/test-config`
 * (private to the separate papercusp monorepo) was added as a devDependency and imported from
 * vitest.config.ts, which made `npm install` die E404. node_modules then never materialized, so
 * the build lost `@types/node` (TS2688) and vitest could not load its own config. The gate went
 * red for ~12h with ZERO named failing tests, because nothing ever got far enough to run.
 *
 * These checks fail loudly, as ordinary unit failures, if that class returns.
 */

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

function readJson(relativePath: string): Record<string, unknown> {
  const raw = readFileSync(new URL(relativePath, new URL('..', import.meta.url)), 'utf8');
  // tsconfig files are JSONC in principle; strip line comments and trailing commas so this
  // guard keeps working if someone documents a compiler option inline.
  const stripped = raw
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(stripped) as Record<string, unknown>;
}

function dependencyBlocks(pkg: Record<string, unknown>): Record<string, string> {
  const blocks = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
  const merged: Record<string, string> = {};
  for (const block of blocks) {
    const entries = pkg[block];
    if (entries && typeof entries === 'object') {
      Object.assign(merged, entries as Record<string, string>);
    }
  }
  return merged;
}

/** Map a tsconfig `types` entry onto the package that must provide it. */
function typesEntryToPackage(entry: string): string {
  // 'vitest/globals' -> 'vitest'; '@scope/pkg/sub' -> '@scope/pkg'; 'node' -> '@types/node'.
  if (entry.startsWith('@')) {
    const [scope, name] = entry.split('/');
    return name ? `${scope}/${name}` : entry;
  }
  const [head] = entry.split('/');
  return entry.includes('/') ? (head as string) : `@types/${head}`;
}

describe('standalone packaging', () => {
  const pkg = readJson('./package.json');
  const declared = dependencyBlocks(pkg);

  it('declares no workspace-private @papercusp/* dependency', () => {
    // A @papercusp/* package is private to the monorepo and 404s from the public registry,
    // which fails `npm install` outright rather than degrading gracefully.
    const workspaceOnly = Object.keys(declared).filter((name) => name.startsWith('@papercusp/'));
    expect(workspaceOnly).toEqual([]);
  });

  it('declares every type package its tsconfigs name in `types`', () => {
    const missing: string[] = [];
    for (const configName of ['./tsconfig.json', './tsconfig.build.json']) {
      const config = readJson(configName);
      const compilerOptions = (config.compilerOptions ?? {}) as Record<string, unknown>;
      const types = compilerOptions.types;
      if (!Array.isArray(types)) continue;
      for (const entry of types as string[]) {
        const required = typesEntryToPackage(entry);
        if (!(required in declared)) missing.push(`${configName}: types["${entry}"] needs ${required}`);
      }
    }
    // A `types` entry with no declared package only ever resolves via a transitive hoist —
    // it silently disappears the moment the install shape changes (TS2688).
    expect(missing).toEqual([]);
  });

  it('imports nothing from @papercusp/* in its root config files', () => {
    // Root configs (vitest.config.ts, ...) are the blind spot this guard exists for: they are
    // NOT covered by tsconfig's `include`, so tsc never typechecks them and a bad import there
    // surfaces only as a vitest startup error with no failing test named. Match import syntax
    // rather than the bare package name, so prose explaining the rule is not itself a failure.
    const importsWorkspacePackage = /(?:\bfrom|\bimport|\brequire)\s*\(?\s*(['"])@papercusp\/[^'"]+\1/;
    const offenders = readdirSync(repoRoot)
      .filter((name) => /\.(ts|mts|cts|js|mjs|cjs)$/.test(name))
      .filter((name) =>
        importsWorkspacePackage.test(
          readFileSync(new URL(name, new URL('..', import.meta.url)), 'utf8'),
        ),
      );
    expect(offenders).toEqual([]);
  });
});
