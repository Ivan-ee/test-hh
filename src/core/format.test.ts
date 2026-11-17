import { describe, expect, it } from 'vitest';
import { formatBytes, formatDuration, formatMbps, formatRate } from './format.js';

describe('formatBytes', () => {
  it('stays in bytes below 1000', () => {
    expect(formatBytes(0)).toBe('0.00 B');
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(999)).toBe('999 B');
  });

  it('scales dynamically to kB/MB/GB (decimal)', () => {
    expect(formatBytes(1000)).toBe('1.00 kB');
    expect(formatBytes(36_359)).toBe('36.4 kB');
    expect(formatBytes(3_635_929)).toBe('3.64 MB');
    expect(formatBytes(1_180_090_590)).toBe('1.18 GB');
    expect(formatBytes(2_500_000_000_000)).toBe('2.50 TB');
  });

  it('falls back to zero for non-finite or negative values', () => {
    expect(formatBytes(-5)).toBe('0.00 B');
    expect(formatBytes(Number.NaN)).toBe('0.00 B');
  });
});

describe('formatRate', () => {
  it('scales dynamically like sizes', () => {
    expect(formatRate(940)).toBe('940 B/s');
    expect(formatRate(123_456)).toBe('123 kB/s');
    expect(formatRate(8_420_000)).toBe('8.42 MB/s');
    expect(formatRate(1_500_000_000)).toBe('1.50 GB/s');
  });
});

describe('formatMbps', () => {
  it('converts bytes/s to fixed decimal Mbps', () => {
    expect(formatMbps(8_000_000)).toBe('64.00 Mbps');
    expect(formatMbps(1_000_000)).toBe('8.00 Mbps');
    expect(formatMbps(0)).toBe('0.00 Mbps');
  });
});

describe('formatDuration', () => {
  it('uses ms below one second and seconds above', () => {
    expect(formatDuration(0)).toBe('0 ms');
    expect(formatDuration(234)).toBe('234 ms');
    expect(formatDuration(999)).toBe('999 ms');
    expect(formatDuration(3420)).toBe('3.42 s');
  });

  it('renders non-finite values as a dash', () => {
    expect(formatDuration(Number.NaN)).toBe('—');
  });
});
