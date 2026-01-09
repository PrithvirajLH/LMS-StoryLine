/**
 * Crypto polyfill for Azure SDK
 * Ensures crypto.randomUUID() is available globally
 */

import { webcrypto } from 'node:crypto';

if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = webcrypto;
}

export default globalThis.crypto;
