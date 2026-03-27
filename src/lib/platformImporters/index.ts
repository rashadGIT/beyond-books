export * from './types';
export { paypalParser } from './paypalParser';
export { networkForGoodParser } from './networkForGoodParser';
export { kindfulParser } from './kindfulParser';

import type { PlatformParser } from './types';
import { paypalParser } from './paypalParser';
import { networkForGoodParser } from './networkForGoodParser';
import { kindfulParser } from './kindfulParser';

const ALL_PARSERS: PlatformParser[] = [paypalParser, networkForGoodParser, kindfulParser];

/**
 * Detect which platform parser matches the given headers.
 * Returns null if no parser matches (generic/unknown format).
 */
export function detectParser(headers: string[]): PlatformParser | null {
  for (const parser of ALL_PARSERS) {
    if (parser.detect(headers)) return parser;
  }
  return null;
}
