import { describe, expect, it } from 'vitest';
import { fallbackDisplayName, normalizeUrl } from '../src/tracking/domain-normalizer';

describe('normalizeUrl', () => {
  it('reduces any page on a site to its domain', () => {
    expect(normalizeUrl('https://www.youtube.com/watch?v=123')).toBe('youtube.com');
    expect(normalizeUrl('https://youtube.com/feed/subscriptions')).toBe('youtube.com');
    expect(normalizeUrl('https://youtube.com/shorts/abc')).toBe('youtube.com');
    expect(normalizeUrl('https://github.com/user/repo/issues')).toBe('github.com');
    expect(normalizeUrl('https://github.com/user/repo/pulls')).toBe('github.com');
  });

  it('discards query strings, fragments and ports on public hosts', () => {
    expect(normalizeUrl('https://example.com:8443/a?secret=token#frag')).toBe('example.com');
  });

  it('strips only cosmetic host prefixes', () => {
    expect(normalizeUrl('https://m.youtube.com/')).toBe('youtube.com');
    expect(normalizeUrl('https://mobile.twitter.com/')).toBe('twitter.com');
    expect(normalizeUrl('https://amp.cnn.com/')).toBe('cnn.com');
  });

  it('preserves meaningful subdomains, which are distinct products', () => {
    expect(normalizeUrl('https://gemini.google.com/app')).toBe('gemini.google.com');
    expect(normalizeUrl('https://mail.google.com/mail/u/0')).toBe('mail.google.com');
    expect(normalizeUrl('https://docs.google.com/document/d/1')).toBe('docs.google.com');
  });

  it('never reduces a host to a bare public suffix', () => {
    expect(normalizeUrl('https://m.co/')).toBe('m.co');
  });

  it('keeps the port on loopback hosts so dev servers stay separate', () => {
    expect(normalizeUrl('http://localhost:3000/app')).toBe('localhost:3000');
    expect(normalizeUrl('http://localhost:5173/')).toBe('localhost:5173');
    expect(normalizeUrl('http://127.0.0.1:8080/')).toBe('127.0.0.1:8080');
    expect(normalizeUrl('http://localhost/')).toBe('localhost');
  });

  it('refuses to track browser-internal and non-web pages', () => {
    for (const url of [
      'chrome://extensions',
      'brave://settings',
      'edge://flags',
      'about:blank',
      'file:///Users/me/notes.txt',
      'chrome-extension://abcdef/dashboard.html',
      'devtools://devtools/bundled/inspector.html',
      'view-source:https://example.com',
      'data:text/html,<p>hi</p>',
    ]) {
      expect(normalizeUrl(url), url).toBeNull();
    }
  });

  it('returns null rather than throwing on unusable input', () => {
    expect(normalizeUrl(undefined)).toBeNull();
    expect(normalizeUrl(null)).toBeNull();
    expect(normalizeUrl('')).toBeNull();
    expect(normalizeUrl('not a url')).toBeNull();
    expect(normalizeUrl('https://')).toBeNull();
  });

  it('lowercases hosts so casing cannot split a domain in two', () => {
    expect(normalizeUrl('https://GitHub.COM/user')).toBe('github.com');
  });
});

describe('fallbackDisplayName', () => {
  it('uses the most distinctive label', () => {
    expect(fallbackDisplayName('youtube.com')).toBe('Youtube');
    expect(fallbackDisplayName('gemini.google.com')).toBe('Gemini');
    expect(fallbackDisplayName('localhost:3000')).toBe('Localhost');
  });
});
