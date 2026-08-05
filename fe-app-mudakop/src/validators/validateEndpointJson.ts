import { ValidationResult } from './types';

export function validateEndpointJson(value: string): ValidationResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    return { valid: false, message: _('Invalid JSON format') };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { valid: false, message: _('Endpoint must be a JSON object') };
  }

  const type = (parsed as Record<string, unknown>).type;

  if (typeof type !== 'string' || type.length === 0) {
    return {
      valid: false,
      message: _('Endpoint must contain a non-empty "type" field'),
    };
  }

  return { valid: true, message: _('Valid') };
}
