/**
 * HTML Parser wrapper - uses linkedom in service worker context
 */

import { parseHTML } from 'linkedom';

export function createDocument(html: string): Document {
  const { document } = parseHTML(html);
  return document as unknown as Document;
}
