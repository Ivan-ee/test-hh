import { EXIT_CODES, connectMs } from '../core/domain.js';
import { formatBytes, formatDuration, formatRate } from '../core/format.js';
import { runSeries } from '../core/run.js';
import { preflight } from '../core/validate.js';
import type { RunConfig } from './index.js';

/**
 * Plain-text mode for non-TTY stdout (pipes, CI): one line per finished
 * probe, then the summary. The terminal-analog of reduced motion —
 * no redraws, append-only output.
 */
export async function runPlain(config: RunConfig): Promise<void> {
  const pf = await preflight(config.target);
  if (!pf.ok) {
    console.error(`✗ ${pf.error}`);
    process.exitCode = EXIT_CODES.usage;
    return;
  }

  const info = pf.info;
  const meta = [
    info.contentType,
    info.contentLength === null ? null : formatBytes(info.contentLength),
  ]
    .filter((part) => part !== null)
    .join(' · ');
  console.log(`Target: ${info.url}${meta.length > 0 ? ` (${meta})` : ''}`);
  console.log(
    `Requests: ${config.requests}, per-probe timeout: ${config.timeoutMs > 0 ? formatDuration(config.timeoutMs) : 'off'}`,
  );
  console.log('');

  const result = await runSeries(
    { ...config, targetInfo: info },
    {
      onProbeDone: (probe) => {
        if (probe.status === 'failed') {
          console.log(`✘ #${probe.index + 1}  ${probe.error}`);
          return;
        }
        const connect = probe.phases ? connectMs(probe.phases) : null;
        const detail =
          connect === null || probe.phases === null
            ? ''
            : `  (connect ${formatDuration(connect)} · ttfb ${formatDuration(probe.phases.ttfbMs ?? 0)} · dl ${formatDuration(probe.phases.downloadMs ?? 0)})`;
        console.log(
          `✔ #${probe.index + 1}  ${formatDuration(probe.durationMs)}  ${formatBytes(probe.bytes)}  ${formatRate(probe.speedBps ?? 0)}${detail}`,
        );
      },
    },
  );

  const stats = result.stats;
  console.log('');
  console.log(
    `Downloaded: ${formatBytes(result.totalBytes)} in ${result.requests} requests${stats.failed > 0 ? ` (${stats.failed} failed)` : ''}`,
  );
  console.log(
    `Speed: ${result.runSpeedBps === null ? '—' : formatRate(result.runSpeedBps)} (avg over successful probes)`,
  );
  console.log(
    `Request time: avg ${formatDuration(stats.avgMs)} · median ${formatDuration(stats.medianMs)} · min ${formatDuration(stats.minMs)} · max ${formatDuration(stats.maxMs)}`,
  );

  process.exitCode = stats.successful > 0 ? EXIT_CODES.ok : EXIT_CODES.failed;
}
