import {afterEach, describe, expect, it, vi} from 'vitest';
import {indexedDbChatStorage} from './storage.js';

const original = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');

afterEach(() => {
  if (original) {
    Object.defineProperty(globalThis, 'indexedDB', original);
  } else {
    Reflect.deleteProperty(globalThis, 'indexedDB');
  }
});

describe('optional IndexedDB storage', () => {
  it('returns no storage when reading IndexedDB is blocked', () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      get() { throw new DOMException('The operation is insecure.', 'SecurityError'); },
    });
    expect(indexedDbChatStorage()).toBeNull();
  });

  it('continues without a cache when opening the database throws', async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: {open() { throw new DOMException('Blocked', 'SecurityError'); }},
    });
    const storage = indexedDbChatStorage();
    expect(await storage?.load('room')).toBeNull();
    await expect(storage?.save('room', {frames: [], serial: 0, hasMore: false})).resolves.toBeUndefined();
    await expect(storage?.remove('room')).resolves.toBeUndefined();
  });

  it('handles an open error before any room uses the cache', async () => {
    const request: Record<string, any> = {error: new Error('Open failed')};
    Object.defineProperty(globalThis, 'indexedDB', {configurable: true, value: {open: () => request}});
    const storage = indexedDbChatStorage();
    request.onerror();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(await storage?.load('room')).toBeNull();
  });

  it('disables failed persistence while keeping later reads and writes usable', async () => {
    const transaction = vi.fn(() => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); });
    const request: Record<string, any> = {result: {transaction}};
    Object.defineProperty(globalThis, 'indexedDB', {configurable: true, value: {open: () => request}});
    const storage = indexedDbChatStorage()!;
    request.onsuccess();
    await storage.save('room', {frames: [], serial: 0, hasMore: false});
    expect(await storage.load('room')).toBeNull();
    await storage.remove('room');
    expect(transaction).toHaveBeenCalledOnce();
  });
});
