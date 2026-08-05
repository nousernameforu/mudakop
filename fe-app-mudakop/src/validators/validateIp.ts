import { ValidationResult } from './types';

const IPV4_PATTERN =
  '(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])\\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])';

const H16 = '[0-9a-fA-F]{1,4}';

// Covers full, compressed (::) and IPv4-mapped IPv6 forms
const IPV6_PATTERN = [
  `(?:${H16}:){7}${H16}`,
  `(?:${H16}:){1,7}:`,
  `(?:${H16}:){1,6}:${H16}`,
  `(?:${H16}:){1,5}(?::${H16}){1,2}`,
  `(?:${H16}:){1,4}(?::${H16}){1,3}`,
  `(?:${H16}:){1,3}(?::${H16}){1,4}`,
  `(?:${H16}:){1,2}(?::${H16}){1,5}`,
  `${H16}:(?::${H16}){1,6}`,
  `:(?:(?::${H16}){1,7}|:)`,
  `::(?:ffff(?::0{1,4})?:)?${IPV4_PATTERN}`,
  `(?:${H16}:){1,4}:${IPV4_PATTERN}`,
].join('|');

export const IPV4_REGEX = new RegExp(`^${IPV4_PATTERN}$`);
export const IPV6_REGEX = new RegExp(`^(?:${IPV6_PATTERN})$`);

export function validateIPV4(ip: string): ValidationResult {
  if (IPV4_REGEX.test(ip)) {
    return { valid: true, message: _('Valid') };
  }

  return { valid: false, message: _('Invalid IP address') };
}

export function validateIPV6(ip: string): ValidationResult {
  if (IPV6_REGEX.test(ip)) {
    return { valid: true, message: _('Valid') };
  }

  return { valid: false, message: _('Invalid IPv6 address') };
}

export function validateIP(ip: string): ValidationResult {
  if (IPV4_REGEX.test(ip) || IPV6_REGEX.test(ip)) {
    return { valid: true, message: _('Valid') };
  }

  return { valid: false, message: _('Invalid IP address') };
}
