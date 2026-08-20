import { availableParallelism } from 'node:os';
import { defineConfig } from 'vitest/config';

/**
 * The shared-host vitest worker cap (WI-4300), INLINED.
 *
 * This repo is published STANDALONE (no npm workspaces, no monorepo root), so it must not
 * import `@papercusp/test-config` — that package is `private: true` inside the separate
 * papercusp monorepo and is unresolvable from the public registry. Depending on it made
 * `npm install` die E404, node_modules never materialized, and the green-checkpoint went red
 * with an unattributable failure: the build lost `@types/node` (TS2688) and vitest could not
 * even load this config (startup error, zero FAIL lines). See WI-39951.
 *
 * The upstream helper is a ~15-line pure function over env + core count, so mirroring it here
 * keeps the cap's behaviour identical while leaving the package self-contained. Semantics:
 *   • VITEST_MAX_FORKS set to a positive number → that cap (the green-checkpoint sets 8);
 *   • VITEST_MAX_FORKS explicitly '0'          → uncapped (deliberate dedicated-host escape);
 *   • absent or garbage                        → min(32, max(8, cores / 4)) — on a shared box
 *     "unset" must never mean uncapped, since vitest's default pool is ≈ host cores − 1.
 *
 * minWorkers is pinned to 1 alongside any cap: an unset minWorkers can default to the host
 * core count, and min > max makes Tinypool throw at pool creation — the suite then collects
 * ZERO tests and the gate goes permanently red.
 */
function sharedHostWorkerCap(): { maxWorkers?: number; minWorkers?: number } {
  const raw = process.env.VITEST_MAX_FORKS;
  const hostSaneCap = Math.min(32, Math.max(8, Math.floor(availableParallelism() / 4)));
  const cap =
    raw === undefined || raw.trim() === ''
      ? hostSaneCap // absent ⇒ host-sane default (never uncapped)
      : raw.trim() === '0'
        ? 0 // explicit 0 ⇒ deliberate uncapped escape hatch
        : Number(raw) > 0
          ? Number(raw)
          : hostSaneCap; // garbage ⇒ safe default, never uncapped
  return cap > 0 ? { maxWorkers: cap, minWorkers: 1 } : {};
}

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Every project sharing this host must agree on a bounded worker count or concurrent
    // suites oversubscribe the box (and vitest 4 refuses a min/max-conflicting pool).
    ...sharedHostWorkerCap(),
  },
});
