/**
 * Domain model — terms are defined in GLOSSARY.md.
 * Pure types and pure helpers only: no I/O, no UI.
 */

export type ProbeStatus = 'success' | 'failed';

/**
 * Timing segments of one probe, all in milliseconds.
 * dns + tcp + tls form the connect phase; the segments never overlap,
 * so dns + tcp + tls + ttfb + download ≈ probe duration (redirect hops aside).
 */
export interface PhaseTimings {
  /** DNS lookup segment. */
  dnsMs: number | null;
  /** TCP connect segment. */
  tcpMs: number | null;
  /** TLS handshake segment (null for plain http targets). */
  tlsMs: number | null;
  /** TTFB segment: from established connection to response headers. */
  ttfbMs: number | null;
  /** Download segment: from headers to the last body byte. */
  downloadMs: number | null;
}

export interface ProbeResult {
  /** 0-based position in the run. */
  index: number;
  status: ProbeStatus;
  /** Probe duration: request start → last byte (or the failure point). */
  durationMs: number;
  /** Phases of the final redirect hop; null when the probe failed too early to measure any. */
  phases: PhaseTimings | null;
  /** Wire bytes of the response body received (no decompression — see ADR 0002). */
  bytes: number;
  /** Probe speed: bytes / duration. Present only on success. */
  speedBps: number | null;
  /** Final URL after redirects. */
  finalUrl: string;
  redirects: number;
  /** Human-readable failure reason; null on success. */
  error: string | null;
}

export interface RunStats {
  successful: number;
  failed: number;
  minMs: number;
  avgMs: number;
  medianMs: number;
  maxMs: number;
}

/** Availability facts learned during preflight. */
export interface TargetInfo {
  url: string;
  contentType: string | null;
  contentLength: number | null;
}

export interface RunResult {
  target: string;
  finalUrl: string;
  /** Requested probe count. */
  requests: number;
  probes: ProbeResult[];
  stats: RunStats;
  /** Sum of successful probe bytes. */
  totalBytes: number;
  /** Sum of successful probe durations. */
  totalDurationMs: number;
  /** Run speed: Σbytes / Σduration. Null when nothing succeeded. */
  runSpeedBps: number | null;
  contentType: string | null;
  contentLength: number | null;
}

/** Live callbacks emitted by a run — consumed by the TUI or the headless mode. */
export interface RunEvents {
  onProbeStart?: (index: number) => void;
  /** Live progress of the running probe: bytes so far and instant bytes/s. */
  onTick?: (index: number, probeBytes: number, instantBps: number) => void;
  onProbeDone?: (result: ProbeResult) => void;
}

/** Connect phase total: DNS + TCP + TLS segments. */
export function connectMs(phases: PhaseTimings): number | null {
  const parts = [phases.dnsMs, phases.tcpMs, phases.tlsMs].filter((v) => v !== null);
  return parts.length > 0 ? parts.reduce((sum, v) => sum + (v ?? 0), 0) : null;
}

/** Process exit codes — part of the tool's contract, documented in docs/architecture.md. */
export const EXIT_CODES = { ok: 0, usage: 1, failed: 2 } as const;
