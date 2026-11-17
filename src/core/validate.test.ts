import { describe, expect, it } from 'vitest';
import { parseTarget } from './validate.js';

describe('parseTarget', () => {
  it('accepts well-formed http(s) URLs and normalizes them', () => {
    expect(parseTarget(' https://example.com/a.png ')).toEqual({
      ok: true,
      url: 'https://example.com/a.png',
    });
  });

  it('rejects empty input', () => {
    expect(parseTarget('   ').ok).toBe(false);
  });

  it('rejects non-URL garbage', () => {
    expect(parseTarget('not a url').ok).toBe(false);
  });

  it('rejects non-http protocols', () => {
    expect(parseTarget('ftp://example.com/file').ok).toBe(false);
    expect(parseTarget('file:///etc/hosts').ok).toBe(false);
  });
});
