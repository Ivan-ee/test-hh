import { describe, expect, it } from 'vitest';
import type { ProbeResult } from './domain.js';
import { computeRunStats, median } from './stats.js';

function probe(durationMs: number, status: 'success' | 'failed' = 'success'): ProbeResult {
  return {
    index: 0,
    status,
    durationMs,
    phases: null,
    bytes: 1000,
    speedBps: status === 'success' ? 1000 : null,
    finalUrl: 'https://example.com/file',
    redirects: 0,
    error: null,
  };
}

describe('median', () => {
  it('picks the middle value for odd counts', () => {
    expect(median([10, 30, 20])).toBe(20);
  });

  it('averages the two middle values for even counts', () => {
    expect(median([10, 20, 30, 40])).toBe(25);
  });

  it('returns zero for empty input', () => {
    expect(median([])).toBe(0);
  });
});

describe('computeRunStats', () => {
  it('computes min/avg/median/max over successful probes', () => {
    const stats = computeRunStats([probe(100), probe(300), probe(200), probe(800)]);
    expect(stats.successful).toBe(4);
    expect(stats.failed).toBe(0);
    expect(stats.minMs).toBe(100);
    expect(stats.avgMs).toBe(350);
    expect(stats.medianMs).toBe(250);
    expect(stats.maxMs).toBe(800);
  });

  it('excludes failed probes from durations but counts them', () => {
    const stats = computeRunStats([probe(100), probe(0, 'failed'), probe(300)]);
    expect(stats.successful).toBe(2);
    expect(stats.failed).toBe(1);
    expect(stats.minMs).toBe(100);
    expect(stats.maxMs).toBe(300);
    expect(stats.medianMs).toBe(200);
  });

  it('returns zeros when everything failed', () => {
    const stats = computeRunStats([probe(0, 'failed'), probe(0, 'failed')]);
    expect(stats.successful).toBe(0);
    expect(stats.failed).toBe(2);
    expect(stats.medianMs).toBe(0);
    expect(stats.maxMs).toBe(0);
  });
});
