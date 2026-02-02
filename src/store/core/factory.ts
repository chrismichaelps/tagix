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
 * Core store class for Tagix state management.
 * @remarks See {@link TagixStore} class documentation for details.
 */
export { TagixStore };
