import { ValidationResult } from './types';
import { IPV6_REGEX, validateIPV4 } from './validateIp';

export function validateSubnet(value: string): ValidationResult {
  // IPv6 entries are recognised by the presence of a colon
  if (value.includes(':')) {
    return validateIPV6Subnet(value);
  }

  // Must be in form X.X.X.X or X.X.X.X/Y
  const subnetRegex = /^(\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?$/;

  if (!subnetRegex.test(value)) {
    return {
      valid: false,
      message: _('Invalid format. Use X.X.X.X or X.X.X.X/Y'),
    };
  }

  const [ip, cidr] = value.split('/');

  if (ip === '0.0.0.0') {
    return { valid: false, message: _('IP address 0.0.0.0 is not allowed') };
  }

  const ipCheck = validateIPV4(ip);
  if (!ipCheck.valid) {
    return ipCheck;
  }

  // Validate CIDR if present
  if (cidr) {
    const cidrNum = parseInt(cidr, 10);

    if (cidrNum < 0 || cidrNum > 32) {
      return {
        valid: false,
        message: _('CIDR must be between 0 and 32'),
      };
    }
  }

  return { valid: true, message: _('Valid') };
}

function validateIPV6Subnet(value: string): ValidationResult {
  const slashCount = (value.match(/\//g) || []).length;

  if (slashCount > 1) {
    return {
      valid: false,
      message: _('Invalid format. Use X::X or X::X/Y'),
    };
  }

  const [ip, prefix] = value.split('/');

  if (!IPV6_REGEX.test(ip)) {
    return { valid: false, message: _('Invalid IPv6 address') };
  }

  if (ip === '::') {
    return { valid: false, message: _('IPv6 address :: is not allowed') };
  }

  if (prefix !== undefined) {
    if (!/^\d{1,3}$/.test(prefix)) {
      return {
        valid: false,
        message: _('IPv6 prefix length must be between 0 and 128'),
      };
    }

    const prefixNum = parseInt(prefix, 10);

    if (prefixNum < 0 || prefixNum > 128) {
      return {
        valid: false,
        message: _('IPv6 prefix length must be between 0 and 128'),
      };
    }
  }

  return { valid: true, message: _('Valid') };
}
