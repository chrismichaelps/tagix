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

import { computed, onScopeDispose, shallowRef, type ComputedRef } from "vue";
import type { TagixStore } from "../store/core/store";
import type { Action, AsyncAction } from "../store/types";

/**
 * Minimal store contract the Vue adapter needs. Both {@link TagixStore} and
 * the read-only derived store satisfy it, so the composables work with either.
 * @internal
 */
export interface ReactiveStore<S> {
  readonly stateValue: S;
  subscribe(callback: (state: S) => void): () => void;
}

type Tagged = { readonly _tag: string };

/**
 * Internal bridge: subscribe a Vue ref to store changes.
 *
 * Uses `shallowRef` (not `ref`) because Tagix state is immutable — we only need
 * identity-based reactivity on the top-level state object, not deep reactivity
 * on its properties. The subscription is tied to the current effect scope and
 * auto-cleaned on component unmount via `onScopeDispose`.
 * @internal
 */
function useStoreRef<S>(store: ReactiveStore<S>) {
  const state = shallowRef(store.stateValue);
  const unsubscribe = store.subscribe((next) => {
    state.value = next;
  });
  onScopeDispose(unsubscribe);
  return state;
}

/**
 * Reactively read the current state of a Tagix store as a `ComputedRef`.
 *
 * The composable subscribes to the store for the lifetime of the calling
 * component's effect scope and auto-unsubscribes on unmount.
 *
 * @example
 * ```ts
 * const state = useTagix(store);
 * // In a template: {{ state._tag }}
 * ```
 */
export function useTagix<S extends Tagged>(store: ReactiveStore<S>): ComputedRef<S> {
  const state = useStoreRef(store);
  return computed(() => state.value);
}

/**
 * Reactively select a derived value from store state as a `ComputedRef`.
 *
 * @param store    - The store to read from.
 * @param selector - Pure function from state to the value you care about.
 *
 * @example
 * ```ts
 * const count = useTagixSelect(store, (s) => (s._tag === "Count" ? s.value : 0));
 * // In a template: {{ count }}
 * ```
 */
export function useTagixSelect<S extends Tagged, T>(
  store: ReactiveStore<S>,
  selector: (state: S) => T
): ComputedRef<T> {
  const state = useStoreRef(store);
  return computed(() => selector(state.value));
}

/**
 * Reactively narrow state to a single variant by tag. Returns a `ComputedRef`
 * of the variant's own properties (without `_tag`) when matched, `undefined`
 * otherwise.
 *
 * @example
 * ```ts
 * const user = useTagixWhen(store, "LoggedIn");
 * // user.value?.name
 * ```
 */
export function useTagixWhen<S extends Tagged, K extends S["_tag"]>(
  store: ReactiveStore<S>,
  tag: K
): ComputedRef<Omit<Extract<S, { _tag: K }>, "_tag"> | undefined> {
  const state = useStoreRef(store);
  return computed(() => {
    if (state.value._tag !== tag) return undefined;
    const { _tag: _t, ...props } = state.value as Extract<S, { _tag: K }>;
    return props as Omit<Extract<S, { _tag: K }>, "_tag">;
  });
}

/**
 * Exhaustively pattern-match store state and reactively return the handler
 * result as a `ComputedRef`. Every variant must be handled — the compiler
 * enforces exhaustiveness.
 *
 * @example
 * ```ts
 * const view = useTagixMatch(store, {
 *   Idle:    () => "spinner",
 *   Loaded:  (s) => s.items.length + " items",
 *   Error:   (s) => s.message,
 * });
 * // view.value
 * ```
 */
export function useTagixMatch<
  S extends Tagged,
  Cases extends { [K in S["_tag"]]: (value: Extract<S, { _tag: K }>) => unknown },
>(store: ReactiveStore<S>, cases: Cases): ComputedRef<ReturnType<Cases[S["_tag"]]>> {
  const state = useStoreRef(store);
  return computed(() => {
    const tag = state.value._tag as S["_tag"];
    const handler = cases[tag] as unknown as (
      value: S
    ) => ReturnType<Cases[S["_tag"]]>;
    return handler(state.value);
  });
}

/**
 * Get a stable, typed dispatch function bound to the store. The returned
 * function is referentially stable (closes over `store` only), safe to use in
 * template event handlers and watchers.
 *
 * @example
 * ```ts
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
  return ((typeOrAction: string | object, payload?: unknown) =>
    store.dispatch(typeOrAction, payload)) as {
    <TPayload>(action: Action<TPayload, S>, payload: TPayload): void;
    <TPayload, TEffect>(
      action: AsyncAction<TPayload, S, TEffect>,
      payload: TPayload
    ): Promise<void>;
    <TPayload>(type: string, payload: TPayload): void | Promise<void>;
  };
}
