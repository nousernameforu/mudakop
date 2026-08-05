import { describe, expect, it } from 'vitest';
import { validateNaiveUrl } from '../validateNaiveUrl';
import { validateProxyUrl } from '../validateProxyUrl';

export const validNaiveUrls = [
  ['https minimal', 'naive+https://example.com'],
  ['https with port', 'naive+https://example.com:443'],
  ['https with credentials', 'naive+https://user:pass@example.com:443'],
  ['quic with credentials', 'naive+quic://user:pass@example.com:443'],
  ['quic without port', 'naive+quic://manhole:114514@quic.test.me'],
  ['spec example', 'naive+https://what:happened@test.someone.cf?padding=false#Naive!'],
  [
    'v2ray style params',
    'naive+quic://admin:password@unchat.ru:443?security=tls&sni=raw.unchat.ru&insecure=0&allowInsecure=0&type=tcp&headerType=none#Naive',
  ],
  ['IPv4 host', 'naive+https://user:pass@185.23.236.193:443'],
  ['IPv6 host bracketed', 'naive+https://user:pass@[2001:db8::1]:443'],
  ['IPv6 host bracketed no port', 'naive+https://user:pass@[2001:db8::1]'],
  ['password containing @', 'naive+https://user:p@ss@example.com:443'],
  ['no credentials with query', 'naive+https://example.com:8443?padding=true'],
];

export const invalidNaiveUrls = [
  ['empty', ''],
  ['bare https scheme', 'https://user:pass@example.com:443'],
  ['bare quic scheme', 'quic://user:pass@example.com:443'],
  ['naive without transport', 'naive://user:pass@example.com:443'],
  ['unknown transport', 'naive+http://user:pass@example.com:443'],
  ['contains space', 'naive+https://user:pass@exa mple.com:443'],
  ['missing host', 'naive+https://user:pass@'],
  ['port zero', 'naive+https://example.com:0'],
  ['port too high', 'naive+https://example.com:70000'],
  ['port not a number', 'naive+https://example.com:abc'],
  ['unbracketed IPv6', 'naive+https://2001:db8::1:443'],
  ['malformed bracketed IPv6', 'naive+https://[2001:db8::zz]:443'],
];

describe('validateNaiveUrl', () => {
  describe.each(validNaiveUrls)('Valid: %s', (_desc, url) => {
    it(`returns valid=true for "${url}"`, () => {
      expect(validateNaiveUrl(url).valid).toBe(true);
    });
  });

  describe.each(invalidNaiveUrls)('Invalid: %s', (_desc, url) => {
    it(`returns valid=false for "${url}"`, () => {
      expect(validateNaiveUrl(url).valid).toBe(false);
    });
  });
});

describe('validateProxyUrl dispatches naive', () => {
  describe.each(validNaiveUrls)('Accepts: %s', (_desc, url) => {
    it(`returns valid=true for "${url}"`, () => {
      expect(validateProxyUrl(url).valid).toBe(true);
    });
  });

  it('still rejects an unknown scheme', () => {
    expect(validateProxyUrl('ftp://example.com').valid).toBe(false);
  });

  it('does not swallow a bare https URL', () => {
    expect(validateProxyUrl('https://example.com').valid).toBe(false);
  });
});
