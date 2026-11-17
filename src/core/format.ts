/**
 * Units formatting.
 *
 * Convention (documented in README):
 * - sizes and speeds are decimal (1000-based), dynamically scaled:
 *   B → kB → MB → GB (and B/s → kB/s → MB/s → GB/s);
 * - the secondary line is fixed decimal Mbps — the ISP/Speedtest vocabulary.
 */

const BYTE_UNITS = ['B', 'kB', 'MB', 'GB', 'TB', 'PB'] as const;
const RATE_UNITS = ['B/s', 'kB/s', 'MB/s', 'GB/s', 'TB/s'] as const;

function scaleTo(
  value: number,
  base: number,
  units: readonly string[],
): { scaled: number; unit: string } {
  if (!Number.isFinite(value) || value < 0) {
    return { scaled: 0, unit: units[0] ?? '' };
  }
  let scaled = value;
  let unitIndex = 0;
  while (scaled >= base && unitIndex < units.length - 1) {
    scaled /= base;
    unitIndex += 1;
  }
  return { scaled, unit: units[unitIndex] ?? '' };
}

/** 3 significant digits: 512 B, 12.3 kB, 3.64 MB, 1.18 GB. */
function significant(value: number): string {
  if (value >= 100) return value.toFixed(0);
  if (value >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

/** Dynamic decimal size: 500 B → 3.64 MB → 1.18 GB. */
export function formatBytes(bytes: number): string {
  const { scaled, unit } = scaleTo(bytes, 1000, BYTE_UNITS);
  return `${significant(scaled)} ${unit}`;
}

/** Dynamic decimal rate: 512 B/s → 8.42 MB/s. */
export function formatRate(bps: number): string {
  const { scaled, unit } = scaleTo(bps, 1000, RATE_UNITS);
  return `${significant(scaled)} ${unit}`;
}

/** Fixed decimal Mbps — what users compare against their ISP plan. */
export function formatMbps(bps: number): string {
  const mbps = (bps * 8) / 1_000_000;
  return `${mbps.toFixed(2)} Mbps`;
}

/** Probe durations: 234 ms | 3.42 s. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}
