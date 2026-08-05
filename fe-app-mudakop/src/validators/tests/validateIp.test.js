import { describe, it, expect } from 'vitest';
import { validateIP, validateIPV4, validateIPV6 } from '../validateIp';

export const validIPs = [
  ['Private LAN', '192.168.1.1'],
  ['All zeros', '0.0.0.0'],
  ['Broadcast', '255.255.255.255'],
  ['Simple', '1.2.3.4'],
  ['Loopback', '127.0.0.1'],
];

export const invalidIPs = [
  ['Octet too large', '256.0.0.1'],
  ['Too few octets', '192.168.1'],
  ['Too many octets', '1.2.3.4.5'],
  ['Leading zero (1st octet)', '01.2.3.4'],
  ['Leading zero (2nd octet)', '1.02.3.4'],
  ['Leading zero (3rd octet)', '1.2.003.4'],
  ['Leading zero (4th octet)', '1.2.3.004'],
  ['Four digits in octet', '1.2.3.0004'],
  ['Trailing dot', '1.2.3.'],
];

export const validIPV6s = [
  ['Loopback', '::1'],
  ['Unspecified', '::'],
  ['Full form', '2001:0db8:0000:0000:0000:0000:0000:0001'],
  ['Compressed', '2001:db8::1'],
  ['Documentation prefix', '2001:db8::'],
  ['Link local', 'fe80::1'],
  ['ULA', 'fd00::1234'],
  ['Cloudflare DNS', '2606:4700:4700::1111'],
  ['Google DNS', '2001:4860:4860::8888'],
  ['Uppercase hex', '2001:DB8::ABCD'],
  ['IPv4-mapped', '::ffff:192.168.1.1'],
  ['Trailing compression', '2001:db8:1:2:3:4:5::'],
];

export const invalidIPV6s = [
  ['Empty string', ''],
  ['IPv4 address', '192.168.1.1'],
  ['Double compression', '2001:db8::1::2'],
  ['Too many groups', '1:2:3:4:5:6:7:8:9'],
  ['Group too long', '2001:db8::12345'],
  ['Illegal hex char', '2001:db8::zzzz'],
  ['Bare word', 'example.com'],
  ['Bracketed', '[2001:db8::1]'],
];

describe('validateIPV4', () => {
  describe.each(validIPs)('Valid IP: %s', (_desc, ip) => {
    it(`returns {valid:true} for "${ip}"`, () => {
      const res = validateIPV4(ip);
      expect(res.valid).toBe(true);
    });
  });

  describe.each(invalidIPs)('Invalid IP: %s', (_desc, ip) => {
    it(`returns {valid:false} for "${ip}"`, () => {
      const res = validateIPV4(ip);
      expect(res.valid).toBe(false);
    });
  });

  describe.each(validIPV6s)('Rejects IPv6: %s', (_desc, ip) => {
    it(`returns {valid:false} for "${ip}"`, () => {
      const res = validateIPV4(ip);
      expect(res.valid).toBe(false);
    });
  });
});

describe('validateIPV6', () => {
  describe.each(validIPV6s)('Valid IPv6: %s', (_desc, ip) => {
    it(`returns {valid:true} for "${ip}"`, () => {
      const res = validateIPV6(ip);
      expect(res.valid).toBe(true);
    });
  });

  describe.each(invalidIPV6s)('Invalid IPv6: %s', (_desc, ip) => {
    it(`returns {valid:false} for "${ip}"`, () => {
      const res = validateIPV6(ip);
      expect(res.valid).toBe(false);
    });
  });
});

describe('validateIP', () => {
  describe.each([...validIPs, ...validIPV6s])(
    'Accepts either family: %s',
    (_desc, ip) => {
      it(`returns {valid:true} for "${ip}"`, () => {
        const res = validateIP(ip);
        expect(res.valid).toBe(true);
      });
    },
  );

  describe.each(invalidIPs)('Rejects malformed IPv4: %s', (_desc, ip) => {
    it(`returns {valid:false} for "${ip}"`, () => {
      const res = validateIP(ip);
      expect(res.valid).toBe(false);
    });
  });
});
