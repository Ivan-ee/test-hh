import type { ProbeResult, RunEvents, RunResult, TargetInfo } from './domain.js';
import { probe } from './measure.js';
import { computeRunStats } from './stats.js';

export interface RunOptions {
  target: string;
  /** Number of sequential probes (assignment default: 10). */
  requests: number;
  timeoutMs: number;
  targetInfo: TargetInfo;
}

/**
 * A Run: N sequential probes against one target, each fully downloaded
 * before the next starts. Emits live events; returns aggregate results.
 */
export async function runSeries(options: RunOptions, events: RunEvents = {}): Promise<RunResult> {
  const probes: ProbeResult[] = [];

  for (let index = 0; index < options.requests; index += 1) {
    events.onProbeStart?.(index);
    const result = await probe({
      target: options.target,
      timeoutMs: options.timeoutMs,
      onTick: (probeBytes, instantBps) => events.onTick?.(index, probeBytes, instantBps),
    });
    result.index = index;
    probes.push(result);
    events.onProbeDone?.(result);
  }

  const successful = probes.filter((p) => p.status === 'success');
  const totalBytes = successful.reduce((sum, p) => sum + p.bytes, 0);
  const totalDurationMs = successful.reduce((sum, p) => sum + p.durationMs, 0);

  return {
    target: options.target,
    finalUrl: successful.at(-1)?.finalUrl ?? options.target,
    requests: options.requests,
    probes,
    stats: computeRunStats(probes),
    totalBytes,
    totalDurationMs,
    runSpeedBps: totalDurationMs > 0 ? (totalBytes * 1000) / totalDurationMs : null,
    contentType: options.targetInfo.contentType,
    contentLength: options.targetInfo.contentLength,
  };
}
