import type { TargetInfo } from './domain.js';
import { DEFAULT_MAX_REDIRECTS, errorMessage, headerValue, requestAttempt } from './measure.js';

export type PreflightOutcome = { ok: true; info: TargetInfo } | { ok: false; error: string };

export type ParseOutcome = { ok: true; url: string } | { ok: false; error: string };

/** Syntax check: must be a well-formed http(s) URL. */
export function parseTarget(raw: string): ParseOutcome {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: 'URL is empty' };
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, error: `Not a valid URL: ${trimmed}` };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, error: `Only http(s) URLs are supported, got: ${url.protocol}` };
  }
  return { ok: true, url: url.toString() };
}

const PREFLIGHT_TIMEOUT_MS = 15_000;

/**
 * Preflight: prove the target actually serves a body before burning the
 * run on it. A headers-only GET (body dropped right away) — HEAD alone
 * lies on some servers, GET never does.
 */
export async function preflight(url: string): Promise<PreflightOutcome> {
  let current = url;

  for (let hop = 0; hop <= DEFAULT_MAX_REDIRECTS; hop += 1) {
    let res;
    try {
      res = await requestAttempt(current, PREFLIGHT_TIMEOUT_MS);
    } catch (err) {
      return { ok: false, error: `Target is unreachable: ${errorMessage(err)}` };
    }

    const status = res.status;
    const location = headerValue(res.headers, 'location');

    if (status >= 300 && status < 400 && location) {
      res.dispose();
      if (hop === DEFAULT_MAX_REDIRECTS) {
        return {
          ok: false,
          error: `Too many redirects during preflight (limit ${DEFAULT_MAX_REDIRECTS})`,
        };
      }
      const next = new URL(location, current);
      if (next.protocol !== 'http:' && next.protocol !== 'https:') {
        return { ok: false, error: `Unsupported redirect protocol: ${next.protocol}` };
      }
      current = next.toString();
      continue;
    }

    const lengthHeader = headerValue(res.headers, 'content-length');
    const parsedLength = lengthHeader === null ? Number.NaN : Number.parseInt(lengthHeader, 10);
    const info: TargetInfo = {
      url: current,
      contentType: headerValue(res.headers, 'content-type'),
      contentLength: Number.isFinite(parsedLength) && parsedLength > 0 ? parsedLength : null,
    };
    res.dispose();

    if (status < 200 || status >= 300) {
      return { ok: false, error: `Preflight failed: HTTP ${status} for ${current}` };
    }
    return { ok: true, info };
  }

  return {
    ok: false,
    error: `Too many redirects during preflight (limit ${DEFAULT_MAX_REDIRECTS})`,
  };
}
