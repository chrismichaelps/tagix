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

import { createStore } from "../core/factory";
import { createAction } from "../actions";
import type { TagixStore } from "../core/store";
import { type Action, type AsyncAction, type StoreConfig, isAsyncAction } from "../types";
import type { TaggedEnumConstructor } from "../../lib/Data/tagged-enum";

/** Union of every key present on any variant of the state union. */
type AllVariantKeys<S> = S extends unknown ? keyof S : never;

/** The type of a field across every variant that declares it, unioned. */
type VariantField<S, K extends PropertyKey> = S extends { [P in K]: infer T } ? T : never;

/**
 * Relaxed state for slice transitions — the discriminated union plus a precise
 * map of every variant field, so handlers can spread (`{ ...s, _tag: "X" }`) and
 * read a field without first narrowing, while typos still fail to compile.
 */
type RelaxedState<S extends { readonly _tag: string }> = S & {
  [K in AllVariantKeys<S>]: VariantField<S, K>;
};

/**
 * A synchronous state transition for a slice: maps the current state (and an
 * optional payload) to the next state.
 */
export type SliceTransition<S extends { readonly _tag: string }> = (
  state: RelaxedState<S>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...payload: any[]
) => S;

/**
 * A single slice action definition: either a synchronous transition, or a
 * pre-built async action (from `createAsyncAction(...)`) for side effects.
 */
export type SliceAction<S extends { readonly _tag: string }> =
  | SliceTransition<S>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | AsyncAction<any, S, any>;

/** The record of named actions passed to {@link createSlice}. */
export type SliceTransitions<S extends { readonly _tag: string }> = Record<string, SliceAction<S>>;

/**
 * The bound, typed dispatcher derived from a slice action.
 * - An async action becomes `(payload: P) => Promise<void>`.
 * - A transition that declares a payload becomes `(payload: P) => void`.
 * - A transition that takes only the state becomes `() => void`.
 */
export type BoundAction<H> =
  H extends AsyncAction<infer P, infer _S, infer _E>
    ? (payload: P) => Promise<void>
    : H extends (...args: never[]) => unknown
      ? Parameters<H> extends [unknown, infer P]
        ? (payload: P) => void
        : () => void
      : never;

/**
 * The result of {@link createSlice}: a ready-to-use store plus an object of
 * bound, fully-typed action dispatchers (one per transition).
 */
export interface Slice<S extends { readonly _tag: string }, A extends SliceTransitions<S>> {
  /** The underlying store. Use it for selectors, subscriptions, or registering async actions. */
  readonly store: TagixStore<S>;
  /** Bound, typed dispatchers — call `slice.actions.increment(payload)` directly. */
  readonly actions: { [K in keyof A]: BoundAction<A[K]> };
}

/**
 * Creates a store with its state transitions colocated, auto-registered, and
 * exposed as bound, fully-typed dispatchers — tagix's low-boilerplate authoring
 * API (in the spirit of Redux Toolkit's `createSlice` and Pinia/Zustand stores).
 *
 * Replaces the create-store → create-action → register → string-dispatch dance
 * with a single declaration. Each transition's payload type is inferred and
 * flows into the matching `actions` dispatcher.
 *
 * @typeParam S - The tagged-union state type.
 * @typeParam A - The record of named transitions.
 * @param config - State, its schema (tagged-enum constructor), the transitions,
 *   and optional store config.
 * @returns A {@link Slice} with `store` and bound `actions`.
 *
 * @remarks
 * Transitions are synchronous. For async side effects, create the store via this
 * helper (or `createStore`) and register a `createAsyncAction` on `slice.store`.
 *
 * @example
 * ```ts
 * const CounterState = taggedEnum({ Idle: { value: 0 }, Ready: { value: 0 } });
 *
 * const counter = createSlice({
 *   state: CounterState.Idle({ value: 0 }),
 *   schema: CounterState,
 *   actions: {
 *     increment: (s, p: { amount: number }) => CounterState.Ready({ value: s.value + p.amount }),
 *     reset: () => CounterState.Idle({ value: 0 }),
 *   },
 * });
 *
 * counter.actions.increment({ amount: 5 }); // typed — payload required
 * counter.actions.reset();                  // typed — no payload
 * counter.store.select((s) => s.value);     // selectors via the store
 * ```
 */
export function createSlice<
  S extends { readonly _tag: string },
  A extends SliceTransitions<S>,
>(config: {
  state: S;
  schema: TaggedEnumConstructor<S>;
  actions: A;
  config?: StoreConfig<S>;
}): Slice<S, A> {
  const store = createStore(config.state, config.schema, config.config);
  const actions = {} as { [K in keyof A]: BoundAction<A[K]> };

  const bound = actions as Record<string, (payload?: unknown) => void | Promise<void>>;

  for (const key of Object.keys(config.actions)) {
    const def = config.actions[key];

    if (isAsyncAction(def)) {
      // Pre-built async action: register it under the slice key and dispatch the
      // object directly so its effect/onSuccess/onError lifecycle runs.
      const asyncAction = def as AsyncAction<unknown, S, unknown>;
      store.register(key, asyncAction);
      bound[key] = (payload?: unknown) => store.dispatch(asyncAction, payload);
      continue;
    }

    // Synchronous transition. Cast to a base-state handler: RelaxedState<S> is
    // assignable to S, so this satisfies withState's parameter (contravariant)
    // without coupling to the actions module's internal RelaxedState alias.
    const action = createAction<unknown, S>(key).withState(
      def as unknown as (state: S, payload: unknown) => S
    );
    store.register(key, action);
    bound[key] = (payload?: unknown) => store.dispatch(action as Action<unknown, S>, payload);
  }

  return { store, actions };
}

/**
 * The bound dispatcher derived from a pre-built action. An async action becomes
 * `(payload: P) => Promise<void>`; a sync action becomes `(payload: P) => void`.
 */
export type BoundDispatcher<A> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  A extends AsyncAction<infer P, any, any>
    ? (payload: P) => Promise<void>
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any
      A extends Action<infer P, any>
      ? (payload: P) => void
      : never;

/**
 * Registers a group of pre-built actions on a store and returns bound, typed
 * dispatchers — call `actions.login(payload)` instead of
 * `store.dispatch(login, payload)` or the stringly-typed `store.dispatch("Login", payload)`.
 *
 * Use this when you already have `createAction` / `createActionGroup` definitions
 * and want the same call ergonomics as {@link createSlice} without rewriting them.
 *
 * @typeParam S - The store's state type.
 * @typeParam G - The record of actions.
 * @param store - The store to register on and dispatch through.
 * @param group - A record of actions (e.g. from `createActionGroup`).
 * @returns An object of bound dispatchers, one per action.
 *
 * @example
 * ```ts
 * const UserActions = createActionGroup("User", { login, logout });
 * const actions = bindActions(store, UserActions);
 *
 * actions.login({ name: "Ada" }); // typed; dispatches through the store
 * ```
 */
export function bindActions<
  S extends { readonly _tag: string },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  G extends Record<string, Action<any, S> | AsyncAction<any, S, any>>,
>(store: TagixStore<S>, group: G): { [K in keyof G]: BoundDispatcher<G[K]> } {
  store.registerGroup(group as unknown as Record<string, Action<unknown, S>>);
  const bound = {} as { [K in keyof G]: BoundDispatcher<G[K]> };

  for (const key of Object.keys(group)) {
    const action = group[key];
    (bound as Record<string, (payload?: unknown) => void | Promise<void>>)[key] = (
      payload?: unknown
    ) =>
      isAsyncAction(action)
        ? store.dispatch(action as AsyncAction<unknown, S, unknown>, payload)
        : store.dispatch(action as Action<unknown, S>, payload);
  }

  return bound;
}
