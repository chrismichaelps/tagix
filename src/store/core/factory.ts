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

import type { TaggedEnumConstructor } from "../../lib/Data/tagged-enum";
import type { StoreConfig } from "../types";
import { TagixStore } from "./store";

/**
 * Creates a new TagixStore instance.
 * @param initialState - The starting state, must have a `_tag` property.
 * @param stateConstructor - TaggedEnum constructor for state type safety.
 * @param config - Optional store configuration.
 * @returns A new TagixStore instance.
 * @example
 * ```ts
 * const store = createStore(
 *   CounterState.Value({ count: 0 }),
 *   CounterState,
 *   { name: "Counter" }
 * );
 * ```
 */
export function createStore<S extends { readonly _tag: string }>(
  initialState: S,
  stateConstructor: TaggedEnumConstructor<S>,
  config?: StoreConfig<S>
): TagixStore<S> {
  return new TagixStore(initialState, stateConstructor, config);
}

/**
 * Creates an isolated fork of a store with its own state copy.
 * @typeParam S - The state type, must be a discriminated union with `_tag` property.
 * @param store - The source store to fork.
 * @returns A new store with an independent copy of the source state.
 * @remarks
 * The forked store:
 * - Has its own isolated state (changes don't affect the source)
 * - Starts with the same state as the source at fork time
 * - Has all registered actions from the source copied over
 * - Uses `strict: false` to allow state transitions that may differ from source
 * - Has independent error history
 *
 * @example
 * ```ts
 * const mainStore = createStore(UserState.LoggedOut({}), UserState);
 * mainStore.registerGroup(UserActions);
 *
 * const forkedStore = fork(mainStore);
 * forkedStore.dispatch(UserActions.login, { username: "temp" });
 *
 * console.log(mainStore.stateValue._tag); // "LoggedOut"
 * console.log(forkedStore.stateValue._tag); // "LoggedIn"
 * ```
 */
export function fork<S extends { readonly _tag: string }>(store: TagixStore<S>): TagixStore<S> {
  const currentState = store.stateValue;
  const stateConstructor = store.getStateConstructor();

  const forkStore = createStore(currentState, stateConstructor, {
    name: `${store.name}-fork`,
    strict: false,
    maxErrorHistory: 10,
    maxRetries: 3,
    middlewares: undefined,
  });

  const actions = store.getActions();
  for (const [type, action] of actions) {
    forkStore.register(type.replace("tagix/action/", ""), action as any);
  }

  return forkStore;
}

/**
 * Core store class for Tagix state management.
 * @remarks See {@link TagixStore} class documentation for details.
 */
export { TagixStore };
