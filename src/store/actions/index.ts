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

import type { Action, AsyncAction } from "../types";
import type { TagixContext } from "../context";
import { ACTION_TYPE_PREFIX } from "../constants";

/**
 * Union of every key present on any variant of the state discriminated union.
 * Uses a distributive conditional so a key need only exist on one variant
 * (unlike `keyof S`, which is the intersection of keys present on all members).
 */
type AllVariantKeys<S> = S extends any ? keyof S : never;

/**
 * The type of a single field across every variant that declares it, unioned.
 * Distributive over `S`: for each member that has key `K`, contribute its type.
 */
type VariantField<S, K extends PropertyKey> = S extends { [P in K]: infer T } ? T : never;

/**
 * State parameter type for action handlers.
 *
 * Intersects the real discriminated union with a map of every variant field,
 * keyed precisely. This keeps two ergonomics the original code relied on —
 * spreading (`{ ...s, _tag: "X" }`) and accessing a field without narrowing —
 * while closing the `any` hole: typos (`s.usr`) now fail to compile, and
 * autocomplete only offers real fields. Each field carries its actual type
 * (e.g. `value: number`), not `any`.
 */
type RelaxedState<T extends { readonly _tag: string }> = T & {
  [K in AllVariantKeys<T>]: VariantField<T, K>;
};

interface ActionBuilder<TPayload, TState extends { readonly _tag: string }> {
  withPayload(payload: TPayload): ActionBuilder<TPayload, TState>;
  withState(
    handler: (state: RelaxedState<TState>, payload: TPayload) => TState
  ): Action<TPayload, TState>;
  withHandler(
    handler: (
      state: RelaxedState<TState>,
      payload: TPayload,
      context: TagixContext<TState>
    ) => TState
  ): Action<TPayload, TState>;
}

interface AsyncActionBuilder<TPayload, TState extends { readonly _tag: string }, TEffect> {
  withPayload(payload: TPayload): AsyncActionBuilder<TPayload, TState, TEffect>;
  state(
    stateFn: (currentState: RelaxedState<TState>) => TState
  ): AsyncActionBuilder<TPayload, TState, TEffect>;
  effect(
    effectFn: (payload: TPayload, context: TagixContext<TState>) => Promise<TEffect>
  ): AsyncActionBuilder<TPayload, TState, TEffect>;
  onSuccess(
    handler: (
      currentState: RelaxedState<TState>,
      result: TEffect,
      context: TagixContext<TState>
    ) => TState
  ): AsyncActionBuilder<TPayload, TState, TEffect>;
  onError(
    handler: (
      currentState: RelaxedState<TState>,
      error: unknown,
      context: TagixContext<TState>
    ) => TState
  ): AsyncAction<TPayload, TState, TEffect>;
}

/**
 * Creates a synchronous action builder.
 * @param type - Unique action identifier.
 * @returns Action builder with chainable methods.
 * @example
 * ```ts
 * const increment = createAction<{ amount: number }, CounterState>("Increment")
 *   .withPayload({ amount: 1 })
 *   .withState((s, p) => ({ ...s, count: s.count + p.amount }));
 * ```
 */
export function createAction<TPayload, S extends { readonly _tag: string }>(
  type: string
): ActionBuilder<TPayload, S>;
export function createAction<TPayload = never, S extends { readonly _tag: string } = never>(
  type: string
): ActionBuilder<TPayload, S> {
  let payload: TPayload | undefined;
  let handler: ((state: RelaxedState<S>, payload: TPayload) => S) | undefined;
  let handlerWithContext:
    | ((state: RelaxedState<S>, payload: TPayload, context: TagixContext<S>) => S)
    | undefined;

  return {
    withPayload(p): ActionBuilder<TPayload, S> {
      payload = p;
      return this;
    },
    withState(h): Action<TPayload, S> {
      handler = h;
      return {
        type: `${ACTION_TYPE_PREFIX}${type}`,
        payload: payload as TPayload,
        handler: handler!,
      } as Action<TPayload, S>;
    },
    withHandler(h): Action<TPayload, S> {
      handlerWithContext = h;
      return {
        type: `${ACTION_TYPE_PREFIX}${type}`,
        payload: payload as TPayload,
        handler: () => {
          throw new Error("Handler with context must be called via context");
        },
        handlerWithContext: handlerWithContext!,
      } as unknown as Action<TPayload, S>;
    },
  };
}

/**
 * Creates an asynchronous action builder with side effects.
 * @typeParam TPayload - The payload type.
 * @typeParam S - The state type.
 * @typeParam TEffect - The effect result type.
 * @param type - Unique action identifier.
 * @returns Async action builder with chainable methods.
 * @remarks Builder pattern: call `state`, `effect`, `onSuccess`, then `onError` to complete.
 * `withPayload` is optional — when omitted the payload defaults to `undefined`.
 * @example
 * ```ts
 * const fetchUser = createAsyncAction<{ id: string }, UserState, User>("FetchUser")
 *   .withPayload({ id: "" })
 *   .state(s => ({ ...s, loading: true }))
 *   .effect(p => api.getUser(p.id))
 *   .onSuccess((s, user) => ({ ...s, user, loading: false }))
 *   .onError((s, err) => ({ ...s, error: err, loading: false }));
 * ```
 */
export function createAsyncAction<TPayload, S extends { readonly _tag: string }, TEffect>(
  type: string
): AsyncActionBuilder<TPayload, S, TEffect>;
export function createAsyncAction<
  TPayload = never,
  S extends { readonly _tag: string } = never,
  TEffect = unknown,
>(type: string): AsyncActionBuilder<TPayload, S, TEffect> {
  let stateFn: (currentState: RelaxedState<S>) => S = (s) => s;
  let effectFn: (payload: TPayload, context: TagixContext<S>) => Promise<TEffect> = async () =>
    undefined as TEffect;
  let onSuccessFn: (
    currentState: RelaxedState<S>,
    result: TEffect,
    context: TagixContext<S>
  ) => S = (s) => s;
  let onErrorFn: (currentState: RelaxedState<S>, error: unknown, context: TagixContext<S>) => S = (
    s
  ) => s;
  let payload: TPayload | undefined;

  return {
    withPayload(p): AsyncActionBuilder<TPayload, S, TEffect> {
      payload = p;
      return this;
    },
    state(fn): AsyncActionBuilder<TPayload, S, TEffect> {
      stateFn = fn;
      return this;
    },
    effect(fn): AsyncActionBuilder<TPayload, S, TEffect> {
      effectFn = fn;
      return this;
    },
    onSuccess(fn): AsyncActionBuilder<TPayload, S, TEffect> {
      onSuccessFn = fn;
      return this;
    },
    onError(fn): AsyncAction<TPayload, S, TEffect> {
      onErrorFn = fn;
      return {
        type: `${ACTION_TYPE_PREFIX}${type}`,
        payload: payload as TPayload,
        state: stateFn,
        effect: effectFn,
        onSuccess: onSuccessFn,
        onError: onErrorFn,
      } as AsyncAction<TPayload, S, TEffect>;
    },
  };
}

export { createActionGroup } from "./group";
