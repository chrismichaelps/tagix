/*
MIT License

Copyright (c) 2026 Chris M. (Michael) Pérez

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.
 */

import type { TagixStore } from "../core/store";

/**
 * A minimal synchronous key/value storage, structurally compatible with the Web
 * Storage API (`localStorage` / `sessionStorage`). Provide your own for tests,
 * React Native (`AsyncStorage` wrapped synchronously), or a custom backend.
 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Options for {@link persist}.
 * @typeParam S - The store's state type.
 */
export interface PersistOptions<S extends { readonly _tag: string }> {
  /** Storage key under which the serialized state is saved. */
  readonly key: string;
  /** Storage backend. Defaults to `globalThis.localStorage` when available. */
  readonly storage?: StorageLike;
  /** Serializes state before writing. @default JSON.stringify */
  readonly serialize?: (state: S) => string;
  /** Deserializes the stored string back into state. @default JSON.parse */
  readonly deserialize?: (raw: string) => S;
  /** Called when reading or parsing stored state throws (e.g. corrupt data). */
  readonly onError?: (error: unknown) => void;
}

function resolveStorage(provided: StorageLike | undefined): StorageLike | null {
  if (provided) return provided;
  const candidate = (globalThis as { localStorage?: StorageLike }).localStorage;
  return candidate ?? null;
}

/**
 * Persists a store to a key/value storage: hydrates the store from storage on
 * call, then writes the serialized state on every change. Returns a function
 * that stops persisting.
 *
 * Built on the store's public `setState`/`subscribe`, so it works with any
 * `StorageLike` backend — pass an in-memory object in tests, `localStorage` in
 * the browser, or your own adapter.
 *
 * @typeParam S - The store's state type.
 * @param store - The store to persist.
 * @param options - Persistence options (see {@link PersistOptions}).
 * @returns A cleanup function that unsubscribes from further writes.
 *
 * @remarks
 * - Hydration uses `store.setState`, which honors `strict` validation; corrupt or
 *   invalid stored data is reported via `onError` and otherwise ignored.
 * - State must be serializable by `serialize`/`deserialize` (JSON by default).
 *
 * @example
 * ```ts
 * const store = createStore(CounterState.Idle({ value: 0 }), CounterState);
 * const stop = persist(store, { key: "counter" }); // uses localStorage
 * // ...later
 * stop();
 * ```
 */
export function persist<S extends { readonly _tag: string }>(
  store: TagixStore<S>,
  options: PersistOptions<S>
): () => void {
  const storage = resolveStorage(options.storage);
  if (storage === null) {
    options.onError?.(new Error("persist: no storage available; pass options.storage"));
    return () => {};
  }

  const serialize = options.serialize ?? ((state: S) => JSON.stringify(state));
  const deserialize = options.deserialize ?? ((raw: string) => JSON.parse(raw) as S);

  // Hydrate from storage before subscribing.
  try {
    const raw = storage.getItem(options.key);
    if (raw !== null) {
      store.setState(deserialize(raw));
    }
  } catch (error) {
    options.onError?.(error);
  }

  // Persist on every change. `subscribe` fires immediately with the current
  // (possibly just-hydrated) state, so the stored value stays in sync.
  return store.subscribe((state) => {
    try {
      storage.setItem(options.key, serialize(state));
    } catch (error) {
      options.onError?.(error);
    }
  });
}
