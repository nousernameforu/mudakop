import { describe, expect, it } from 'vitest';
import { validateEndpointJson } from '../validateEndpointJson';

export const validEndpoints = [
  ['Minimal wireguard', '{"type":"wireguard"}'],
  [
    'Full wireguard',
    '{"type":"wireguard","system":false,"address":["172.16.0.2/32"],"private_key":"aGVsbG8=","peers":[{"address":"127.0.0.1","port":51820,"public_key":"aGVsbG8=","allowed_ips":["0.0.0.0/0"]}]}',
  ],
  ['Tailscale', '{"type":"tailscale","auth_key":"tskey-auth-xxx"}'],
];

export const invalidEndpoints = [
  ['Empty object', '{}'],
  ['Broken JSON', '{"type":"wireguard"'],
  ['JSON array', '[{"type":"wireguard"}]'],
  ['JSON null', 'null'],
  ['JSON string', '"wireguard"'],
  ['Empty type', '{"type":""}'],
  ['Non-string type', '{"type":42}'],
];

describe('validateEndpointJson', () => {
  describe.each(validEndpoints)('Valid endpoint: %s', (_desc, endpoint) => {
    it(`returns valid=true for "${endpoint}"`, () => {
      const res = validateEndpointJson(endpoint);
      expect(res.valid).toBe(true);
    });
  });

  describe.each(invalidEndpoints)('Invalid endpoint: %s', (_desc, endpoint) => {
    it(`returns valid=false for "${endpoint}"`, () => {
      const res = validateEndpointJson(endpoint);
      expect(res.valid).toBe(false);
    });
  });
});
