import type { ProbeResult, RunStats } from './domain.js';

/** Median; even counts average the two middle samples. Sorts defensively. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0;
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/**
 * Run stats over successful probes only; failed ones are counted separately.
 * Median is the headline robust estimate (the first probe is always "cold").
 */
export function computeRunStats(probes: readonly ProbeResult[]): RunStats {
  const durations = probes.filter((p) => p.status === 'success').map((p) => p.durationMs);

  if (durations.length === 0) {
    return {
      successful: 0,
      failed: probes.length,
      minMs: 0,
      avgMs: 0,
      medianMs: 0,
      maxMs: 0,
    };
  }

  const total = durations.reduce((sum, v) => sum + v, 0);
  return {
    successful: durations.length,
    failed: probes.length - durations.length,
    minMs: Math.min(...durations),
    avgMs: total / durations.length,
    medianMs: median(durations),
    maxMs: Math.max(...durations),
  };
}
