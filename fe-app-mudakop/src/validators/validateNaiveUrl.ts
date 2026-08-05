import { ValidationResult } from './types';
import { validateDomain } from './validateDomain';
import { IPV6_REGEX, validateIPV4 } from './validateIp';

// The NaiveProxy URI spec defines exactly two schemes. The naive+ prefix exists so the
// scheme stays distinguishable from real https/quic in mixed subscriptions.
// https://gist.github.com/DuckSoft/ca03913b0a26fc77a1da4d01cc6ab2f1
export const NAIVE_SCHEME_REGEX = /^naive\+(https|quic):\/\//;

export function validateNaiveUrl(url: string): ValidationResult {
  try {
    if (!NAIVE_SCHEME_REGEX.test(url)) {
      return {
        valid: false,
        message: _('Invalid Naive URL: must start with naive+https:// or naive+quic://'),
      };
    }

    if (/\s/.test(url)) {
      return {
        valid: false,
        message: _('Invalid Naive URL: must not contain spaces'),
      };
    }

    const body = url.replace(NAIVE_SCHEME_REGEX, '');
    const [beforeFragment] = body.split('#');
    const [authAndHost] = beforeFragment.split('?');

    // Only the last @ separates userinfo from host, since a password may contain one
    const atIndex = authAndHost.lastIndexOf('@');
    const hostPortPart =
      atIndex === -1 ? authAndHost : authAndHost.slice(atIndex + 1);

    if (!hostPortPart) {
      return {
        valid: false,
        message: _('Invalid Naive URL: missing host'),
      };
    }

    let host: string;
    let port: string | undefined;

    const bracketed = hostPortPart.match(/^\[([^\]]+)\](?::(\d+))?$/);
    if (bracketed) {
      host = bracketed[1];
      port = bracketed[2];

      if (!IPV6_REGEX.test(host)) {
        return {
          valid: false,
          message: _('Invalid Naive URL: invalid IPv6 address'),
        };
      }
    } else {
      const parts = hostPortPart.split(':');

      if (parts.length > 2) {
        return {
          valid: false,
          message: _('Invalid Naive URL: IPv6 address must be wrapped in brackets'),
        };
      }

      host = parts[0];
      port = parts[1];

      if (!host) {
        return {
          valid: false,
          message: _('Invalid Naive URL: missing hostname or IP'),
        };
      }

      if (!validateIPV4(host).valid && !validateDomain(host).valid) {
        return {
          valid: false,
          message: _('Invalid Naive URL: invalid host format'),
        };
      }
    }

    // The port is optional: the spec defaults it to 443
    if (port !== undefined) {
      const portNum = Number(port);

      if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
        return {
          valid: false,
          message: _('Invalid Naive URL: invalid port number'),
        };
      }
    }
  } catch {
    return { valid: false, message: _('Invalid Naive URL: parsing failed') };
  }

  return { valid: true, message: _('Valid') };
}
