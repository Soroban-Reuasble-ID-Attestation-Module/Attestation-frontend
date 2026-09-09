import '@testing-library/jest-dom/vitest';

// jsdom lacks crypto.subtle — polyfill with Node's webcrypto for
// commitment tests.
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    writable: true,
  });
}