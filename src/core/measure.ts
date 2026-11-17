import http from 'node:http';
import https from 'node:https';
import type { IncomingHttpHeaders, IncomingMessage } from 'node:http';
import { performance } from 'node:perf_hooks';
import type { PhaseTimings, ProbeResult } from './domain.js';

export const USER_AGENT = 'netspeed/1.0 (download-speed-probe)';
export const DEFAULT_MAX_REDIRECTS = 10;

/** Window for instant speed: short enough to stay live, long enough not to jitter. */
export const SPEED_WINDOW_MS = 500;

export interface ProbeOptions {
  target: string;
  /** Hard per-probe time limit in ms; 0 disables. */
  timeoutMs: number;
  maxRedirects?: number;
  /** Live progress: probe bytes so far and instant bytes/s. */
  onTick?: (probeBytes: number, instantBps: number) => void;
}

/** Rolling-window instant speed — smooths per-chunk jitter into a readable number. */
class RollingSpeed {
  private readonly points: Array<{ at: number; bytes: number }> = [];

  push(at: number, bytes: number): number {
    this.points.push({ at, bytes });
    const cutoff = at - SPEED_WINDOW_MS;
    while (this.points.length > 2 && (this.points[1]?.at ?? 0) < cutoff) {
      this.points.shift();
    }
    const first = this.points[0];
    if (!first) return 0;
    const dt = at - first.at;
    return dt > 0 ? ((bytes - first.bytes) * 1000) / dt : 0;
  }
}

/** Cumulative socket stamps relative to the attempt start, ms. */
interface SocketStamps {
  dnsMs: number | null;
  tcpMs: number | null;
  tlsMs: number | null;
}

/** One HTTP GET on a fresh connection, resolved as soon as headers arrive. */
export interface Attempt {
  status: number;
  headers: IncomingHttpHeaders;
  stream: IncomingMessage;
  /** Absolute performance.now() of the attempt start. */
  startedAt: number;
  headersAt: number;
  stamps: SocketStamps;
  dispose(): void;
}

export function requestAttempt(
  url: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<Attempt> {
  return new Promise((resolve, reject) => {
    const startedAt = performance.now();
    let stamps: SocketStamps = { dnsMs: null, tcpMs: null, tlsMs: null };

    const mod = url.startsWith('https:') ? https : http;
    const req = mod.request(
      url,
      {
        method: 'GET',
        // Fresh connection, closed after the response — see ADR 0001.
        agent: false,
        signal,
        headers: {
          'user-agent': USER_AGENT,
          accept: '*/*',
          // No content negotiation on purpose: Transfer size must be wire bytes — see ADR 0002.
          'accept-encoding': 'identity',
        },
      },
      (stream) => {
        resolve({
          status: stream.statusCode ?? 0,
          headers: stream.headers,
          stream,
          startedAt,
          headersAt: performance.now(),
          stamps,
          dispose() {
            stream.destroy();
            req.destroy();
          },
        });
      },
    );

    req.on('socket', (socket) => {
      socket.once('lookup', () => {
        stamps = { ...stamps, dnsMs: performance.now() - startedAt };
      });
      socket.once('connect', () => {
        stamps = { ...stamps, tcpMs: performance.now() - startedAt };
      });
      socket.once('secureConnect', () => {
        stamps = { ...stamps, tlsMs: performance.now() - startedAt };
      });
    });

    req.on('error', reject);
    if (timeoutMs > 0) {
      req.setTimeout(timeoutMs, () =>
        req.destroy(new Error(`timed out after ${Math.round(timeoutMs / 100) / 10} s`)),
      );
    }
    req.end();
  });
}

function headerValue(headers: IncomingHttpHeaders, name: string): string | null {
  const value = headers[name];
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0] ?? null;
  return null;
}

function redirectLocation(headers: IncomingHttpHeaders): string | null {
  return headerValue(headers, 'location');
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * One Probe: a full GET that waits for the complete body, on a fresh
 * connection per redirect hop. Phases reflect the final hop.
 */
export async function probe(options: ProbeOptions): Promise<ProbeResult> {
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const probeStartedAt = performance.now();
  const rolling = new RollingSpeed();
  let url = options.target;
  let redirects = 0;
  let bytes = 0;

  const controller = new AbortController();
  const timer =
    options.timeoutMs > 0
      ? setTimeout(
          () =>
            controller.abort(
              new Error(`timed out after ${Math.round(options.timeoutMs / 100) / 10} s`),
            ),
          options.timeoutMs,
        )
      : null;

  const fail = (error: string, phases: PhaseTimings | null): ProbeResult => ({
    index: -1,
    status: 'failed',
    durationMs: performance.now() - probeStartedAt,
    phases,
    bytes,
    speedBps: null,
    finalUrl: url,
    redirects,
    error,
  });

  try {
    for (;;) {
      const res = await requestAttempt(url, options.timeoutMs, controller.signal);
      const stamps = res.stamps;
      const connectEnd = stamps.tlsMs ?? stamps.tcpMs;
      const phases: PhaseTimings = {
        dnsMs: stamps.dnsMs,
        tcpMs: stamps.tcpMs === null ? null : stamps.tcpMs - (stamps.dnsMs ?? 0),
        tlsMs: stamps.tlsMs === null || stamps.tcpMs === null ? null : stamps.tlsMs - stamps.tcpMs,
        ttfbMs: connectEnd === null ? null : res.headersAt - res.startedAt - connectEnd,
        downloadMs: null,
      };

      const location = redirectLocation(res.headers);
      if (res.status >= 300 && res.status < 400 && location) {
        res.dispose();
        if (redirects >= maxRedirects) {
          return fail(`more than ${maxRedirects} redirects`, phases);
        }
        const next = new URL(location, url);
        if (next.protocol !== 'http:' && next.protocol !== 'https:') {
          return fail(`unsupported redirect protocol: ${next.protocol}`, phases);
        }
        url = next.toString();
        redirects += 1;
        continue;
      }

      if (res.status < 200 || res.status >= 300) {
        res.dispose();
        return fail(`HTTP ${res.status}`, phases);
      }

      try {
        for await (const chunk of res.stream) {
          bytes += chunk.length;
          const instant = rolling.push(performance.now() - probeStartedAt, bytes);
          options.onTick?.(bytes, instant);
        }
      } catch (err) {
        return fail(`${errorMessage(err)} (received ${bytes} B)`, phases);
      } finally {
        res.dispose();
      }

      const endAt = performance.now();
      const durationMs = endAt - probeStartedAt;
      phases.downloadMs = endAt - res.headersAt;
      return {
        index: -1,
        status: 'success',
        durationMs,
        phases,
        bytes,
        speedBps: durationMs > 0 ? (bytes * 1000) / durationMs : null,
        finalUrl: url,
        redirects,
        error: null,
      };
    }
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export { errorMessage };
export { headerValue };
