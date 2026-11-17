import { describe, expect, it } from 'vitest';
import { connectMs } from './domain.js';

describe('connectMs', () => {
  it('sums dns + tcp + tls segments', () => {
    expect(connectMs({ dnsMs: 12, tcpMs: 8, tlsMs: 26, ttfbMs: 10, downloadMs: 500 })).toBe(46);
  });

  it('works without TLS (plain http)', () => {
    expect(connectMs({ dnsMs: 12, tcpMs: 8, tlsMs: null, ttfbMs: 10, downloadMs: 500 })).toBe(20);
  });

  it('returns null when no connect segment was measured', () => {
    expect(
      connectMs({ dnsMs: null, tcpMs: null, tlsMs: null, ttfbMs: null, downloadMs: null }),
    ).toBeNull();
  });
});
