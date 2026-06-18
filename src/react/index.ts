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

import { useCallback, useRef, useSyncExternalStore } from "react";
import type { TagixStore } from "../store/core/store";
import type { Action, AsyncAction } from "../store/types";

/**
 * Minimal store contract the React adapter needs. Both {@link TagixStore} and
 * the read-only derived store satisfy it, so the hooks work with either.
 * @internal
 */
export interface ReactiveStore<S> {
  readonly stateValue: S;
  subscribe(callback: (state: S) => void): () => void;
}

type Tagged = { readonly _tag: string };

/**
 * Subscribe a React component to a Tagix store via `useSyncExternalStore`.
 *
 * The store's `subscribe` calls the callback once immediately (Tagix contract),
 * which `useSyncExternalStore` tolerates — the snapshot it caches is what drives
 * re-renders, and equality is structural via the cache. Re-renders only happen
 * when `getSnapshot` returns a value `Object.is`-distinct from the last one, so
 * immutable Tagix state transitions are deduplicated automatically.
 *
 * @internal — prefer the public hooks below; this is the shared building block.
 */
function useExternalStore<S>(store: ReactiveStore<S>): S {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      // TagixStore.subscribe invokes the callback immediately. We only need the
      // signal, not the state — forward the change notification and ignore args.
      const unsubscribe = store.subscribe(onStoreChange as (state: S) => void);
      return unsubscribe;
    },
    [store]
  );

  const getSnapshot = useCallback(() => store.stateValue, [store]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Reactively read the current state of a Tagix store. Re-renders on every
 * state change.
 *
 * @example
 * ```tsx
 * const state = useTagix(store);
 * return <p>{state._tag}</p>;
 * ```
 */
export function useTagix<S extends Tagged>(store: ReactiveStore<S>): S {
  return useExternalStore(store);
}

/**
 * Reactively select a derived value from store state. The component only
 * re-renders when the selected value changes, according to `equals`.
 *
 * @param store   - The store to read from.
 * @param selector - Pure function from state to the value you care about.
 * @param equals  - Optional equality check. Defaults to `Object.is`. Use a
 *                  stable reference (e.g. a deep-equal from your dep tree) for
 *                  structural values.
 *
 * @example
 * ```tsx
 * const count = useTagixSelect(store, (s) => (s._tag === "Count" ? s.value : 0));
 * ```
 */
export function useTagixSelect<S extends Tagged, T>(
  store: ReactiveStore<S>,
  selector: (state: S) => T,
  equals: (prev: T, next: T) => boolean = Object.is
): T {
  // Cache the last (snapshot, selected) pair so we can dedup without an extra
  // render. Updating the ref during render is safe here because it is purely a
  // memoization of values derived from the just-read snapshot, not an effect.
  const snapshot = useExternalStore(store);
  const cacheRef = useRef<{ snapshot: S; selected: T } | null>(null);

  if (
    cacheRef.current === null ||
    !Object.is(cacheRef.current.snapshot, snapshot)
  ) {
    const selected = selector(snapshot);
    if (
      cacheRef.current !== null &&
      equals(cacheRef.current.selected, selected)
    ) {
      // Keep the previous selected identity/value; only refresh the source.
      cacheRef.current = { snapshot, selected: cacheRef.current.selected };
    } else {
      cacheRef.current = { snapshot, selected };
    }
  }

  return cacheRef.current.selected;
}

/**
 * Reactively narrow state to a single variant by tag. Returns the variant's
 * own properties (without `_tag`) when the tag matches, otherwise `undefined`.
 * Re-renders only when the match result changes.
 *
 * @example
 * ```tsx
 * const user = useTagixWhen(store, "LoggedIn");
 * return user ? <Welcome name={user.name} /> : <LoginScreen />;
 * ```
 */
export function useTagixWhen<S extends Tagged, K extends S["_tag"]>(
  store: ReactiveStore<S>,
  tag: K
): Omit<Extract<S, { _tag: K }>, "_tag"> | undefined {
  return useTagixSelect(
    store,
    (state) => {
      if (state._tag !== tag) return undefined;
      const { _tag, ...props } = state as Extract<S, { _tag: K }>;
      return props as Omit<Extract<S, { _tag: K }>, "_tag"> | undefined;
    },
    shallowEqual
  );
}

/**
 * Exhaustively pattern-match store state and reactively return the handler
 * result. Every variant must be handled — the compiler enforces exhaustiveness.
 * The return type is the union of all handler return types.
 *
 * @example
 * ```tsx
 * const view = useTagixMatch(store, {
 *   Idle:    () => <Spinner />,
 *   Loaded:  (s) => <List items={s.items} />,
 *   Error:   (s) => <ErrorBanner message={s.message} />,
 * });
 * ```
 */
export function useTagixMatch<
  S extends Tagged,
  Cases extends { [K in S["_tag"]]: (value: Extract<S, { _tag: K }>) => unknown },
>(
  store: ReactiveStore<S>,
  cases: Cases
): ReturnType<Cases[S["_tag"]]> {
  return useTagixSelect(
    store,
    (state) => {
      const tag = state._tag as S["_tag"];
      const handler = cases[tag] as unknown as (value: S) => ReturnType<Cases[S["_tag"]]>;
      return handler(state);
    },
    Object.is
  );
}

/**
 * Get a stable, typed dispatch function bound to the store. The returned
 * function is referentially stable across re-renders (it closes over `store`
 * only), so it is safe to pass as a prop or use in effect deps.
 *
 * Supports action-object dispatch (recommended, fully typed) and legacy
 * string-based dispatch.
 *
 * @example
 * ```tsx
 * const dispatch = useDispatch(store);
 * dispatch(login, { username: "chris" });
 * ```
 */
export function useDispatch<S extends Tagged>(
  store: TagixStore<S>
): {
  <TPayload>(action: Action<TPayload, S>, payload: TPayload): void;
  <TPayload, TEffect>(
    action: AsyncAction<TPayload, S, TEffect>,
    payload: TPayload
  ): Promise<void>;
  <TPayload>(type: string, payload: TPayload): void | Promise<void>;
} {
  return useCallback(
    ((typeOrAction: string | object, payload?: unknown) =>
      store.dispatch(typeOrAction, payload)) as {
      <TPayload>(action: Action<TPayload, S>, payload: TPayload): void;
      <TPayload, TEffect>(
        action: AsyncAction<TPayload, S, TEffect>,
        payload: TPayload
      ): Promise<void>;
      <TPayload>(type: string, payload: TPayload): void | Promise<void>;
    },
    [store]
  );
}

/**
 * Shallow equality for `useTagixWhen` dedup. Plain-object variant props are
 * compared key-by-key; anything else falls back to `Object.is`.
 * @internal
 */
function shallowEqual<T>(prev: T, next: T): boolean {
  if (Object.is(prev, next)) return true;
  if (
    typeof prev !== "object" ||
    prev === null ||
    typeof next !== "object" ||
    next === null
  ) {
    return false;
  }
  const prevKeys = Object.keys(prev as Record<string, unknown>);
  const nextKeys = Object.keys(next as Record<string, unknown>);
  if (prevKeys.length !== nextKeys.length) return false;
  for (const key of prevKeys) {
    if (
      !Object.is(
        (prev as Record<string, unknown>)[key],
        (next as Record<string, unknown>)[key]
      )
    ) {
      return false;
    }
  }
  return true;
}
