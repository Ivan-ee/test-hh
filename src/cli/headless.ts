import { EXIT_CODES } from '../core/domain.js';
import { runSeries } from '../core/run.js';
import { preflight } from '../core/validate.js';
import type { RunConfig } from './index.js';

/**
 * `--json` mode: no TUI, one machine-readable JSON document on stdout.
 * Exit codes: 0 — at least one probe succeeded; 1 — preflight/usage; 2 — all probes failed.
 */
export async function runHeadless(config: RunConfig): Promise<void> {
  const pf = await preflight(config.target);
  if (!pf.ok) {
    console.log(JSON.stringify({ ok: false, error: pf.error }, null, 2));
    process.exitCode = EXIT_CODES.usage;
    return;
  }

  const result = await runSeries({ ...config, targetInfo: pf.info });
  console.log(
    JSON.stringify(
      {
        ok: result.stats.successful > 0,
        ...result,
      },
      null,
      2,
    ),
  );
  process.exitCode = result.stats.successful > 0 ? EXIT_CODES.ok : EXIT_CODES.failed;
}
