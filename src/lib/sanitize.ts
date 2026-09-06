/**
 * Strict Undefined-Stripping (Zero-Crash Payload Hygiene)
 * Strips all undefined values recursively before passing objects to Firestore.
 */
export function cleanPayload<T extends Record<string, any>>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => (typeof item === 'object' ? cleanPayload(item) : item)) as unknown as T;
  }

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue;
    }
    if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
      result[key] = cleanPayload(value);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}
