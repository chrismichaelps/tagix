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
import { ACTION_TYPE_PREFIX } from "../constants";

interface ActionBuilder<TPayload, TState> {
  withPayload(payload: TPayload): ActionBuilder<TPayload, TState>;
  withState(handler: (state: TState, payload: TPayload) => TState): Action<TPayload, TState>;
}

interface AsyncActionBuilder<TPayload, TState, TEffect> {
  state(stateFn: (currentState: TState) => TState): AsyncActionBuilder<TPayload, TState, TEffect>;
  effect(
    effectFn: (payload: TPayload) => Promise<TEffect>
  ): AsyncActionBuilder<TPayload, TState, TEffect>;
  onSuccess(
    handler: (currentState: TState, result: TEffect) => TState
  ): AsyncActionBuilder<TPayload, TState, TEffect>;
  onError(
    handler: (currentState: TState, error: unknown) => TState
  ): AsyncAction<TPayload, TState, TEffect>;
}

export function createAction<TPayload = never, S extends { readonly _tag: string } = never>(
  type: string
): ActionBuilder<TPayload, S> {
  let payload: TPayload | undefined;
  let handler: ((state: S, payload: TPayload) => S) | undefined;

  return {
    withPayload(p): ActionBuilder<TPayload, S> {
      payload = p;
      return this;
    },
    withState(h): Action<TPayload, S> {
      handler = h;
      return {
        type: `${ACTION_TYPE_PREFIX}${type}`,
        payload: payload!,
        handler: handler!,
      } as Action<TPayload, S>;
    },
  };
}

export function createAsyncAction<
  TPayload = never,
  S extends { readonly _tag: string } = never,
  TEffect = never,
>(type: string): AsyncActionBuilder<TPayload, S, TEffect> {
  let stateFn: (currentState: S) => S = (s) => s;
  let effectFn: (payload: TPayload) => Promise<TEffect> = async () => undefined as TEffect;
  let onSuccessFn: (currentState: S, result: TEffect) => S = (s) => s;
  let onErrorFn: (currentState: S, error: unknown) => S = (s) => s;
  let payload: TPayload | undefined;

  return {
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
        payload: payload!,
        state: stateFn,
        effect: effectFn,
        onSuccess: onSuccessFn,
        onError: onErrorFn,
      } as AsyncAction<TPayload, S, TEffect>;
    },
  };
}
