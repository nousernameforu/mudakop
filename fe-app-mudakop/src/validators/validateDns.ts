import { validateDomain } from './validateDomain';
import { IPV6_REGEX, validateIPV4 } from './validateIp';
import { ValidationResult } from './types';

export function validateDNS(value: string): ValidationResult {
  if (!value) {
    return { valid: false, message: _('DNS server address cannot be empty') };
  }

  // Bracketed IPv6 literal, optionally with a port and a DoH path: [2606:4700::1111]:853
  const bracketed = value.match(/^\[([^\]]+)\](?::\d+)?(?:\/.*)?$/);
  if (bracketed) {
    if (IPV6_REGEX.test(bracketed[1])) {
      return { valid: true, message: _('Valid') };
    }

    return { valid: false, message: _('Invalid IPv6 address') };
  }

  // Bare IPv6 literal, which cannot carry a port
  if (IPV6_REGEX.test(value)) {
    return { valid: true, message: _('Valid') };
  }

  const cleanedValueWithoutPort = value.replace(/:(\d+)(?=\/|$)/, '');
  const cleanedIpWithoutPath = cleanedValueWithoutPort.split('/')[0];

  if (validateIPV4(cleanedIpWithoutPath).valid) {
    return { valid: true, message: _('Valid') };
  }

  if (validateDomain(cleanedValueWithoutPort).valid) {
    return { valid: true, message: _('Valid') };
  }

  return {
    valid: false,
    message: _(
      'Invalid DNS server format. Examples: 8.8.8.8 or 2606:4700:4700::1111 or dns.example.com or dns.example.com/nicedns for DoH',
    ),
  };
}
