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

import type { TagixContext } from "../context";

type ExtractTag<S extends { readonly _tag: string }> = S extends { readonly _tag: infer T }
  ? T extends string
    ? T
    : never
  : never;

type ExtractProps<S extends { readonly _tag: string }, T extends string> = S extends {
  readonly _tag: T;
}
  ? Omit<S, "_tag">
  : never;

function isTaggedState<S extends { readonly _tag: string }>(state: S, _tag: string): boolean {
  return state._tag === _tag;
}

function useGetStateRaw<S extends { readonly _tag: string }>(context: TagixContext<S>) {
  function get<T extends ExtractTag<S>>(
    _tag: T,
    key: keyof ExtractProps<S, T>
  ): ExtractProps<S, T>[typeof key] | undefined;
  function get<T extends ExtractTag<S>>(_tag: T): ExtractProps<S, T> | undefined;
  function get<T extends ExtractTag<S>>(_tag: T, key?: keyof ExtractProps<S, T>) {
    const state = context.getCurrent();
    if (isTaggedState(state, _tag)) {
      const props = state as unknown as ExtractProps<S, T>;
      if (key === undefined) {
        return props;
      }
      return props[key];
    }
    return undefined;
  }
  return get;
}

/**
 * Get a type-safe way to read state properties by variant tag.
 *
 * @typeParam S - State type with a tagged enum structure.
 * @returns A function that takes a context and gives you a getter for state props.
 *
 * @example
 * ```ts
 * const getUserState = useGetState<UserStateType>();
 * const context = createContext(store);
 *
 * // IDE will suggest "LoggedOut" | "LoggedIn" for the tag
 * // Then suggests "name" | "email" | "role" based on that tag
 * const name = getUserState(context)("LoggedIn", "name");
 *
 * // Or get the whole props object for a tag
 * const userProps = getUserState(context)("LoggedIn");
 * if (userProps) {
 *   console.log(userProps.name);
 *   console.log(userProps.email);
 * }
 * ```
 */
export function useGetState<S extends { readonly _tag: string }>() {
  return function (context: TagixContext<S>) {
    return useGetStateRaw(context);
  };
}

function getStatePropRaw<S extends { readonly _tag: string }>(state: S) {
  function get<T extends ExtractTag<S>>(
    _tag: T,
    key: keyof ExtractProps<S, T>
  ): ExtractProps<S, T>[typeof key] | undefined;
  function get<T extends ExtractTag<S>>(_tag: T): ExtractProps<S, T> | undefined;
  function get<T extends ExtractTag<S>>(_tag: T, key?: keyof ExtractProps<S, T>) {
    if (isTaggedState(state, _tag)) {
      const props = state as unknown as ExtractProps<S, T>;
      if (key === undefined) {
        return props;
      }
      return props[key];
    }
    return undefined;
  }
  return get;
}

/**
 * Read a specific property from a state object using its variant tag.
 *
 * @typeParam S - State type with a tagged enum structure.
 * @param state - The state object to read from.
 * @returns A getter function for state properties.
 *
 * @example
 * ```ts
 * const state = store.getCurrent();
 *
 * // Get a single property
 * const name = getStateProp(state)("LoggedIn", "name");
 *
 * // Or get the whole props object for a tag
 * const userProps = getStateProp(state)("LoggedIn");
 * if (userProps) {
 *   console.log(userProps.name);
 *   console.log(userProps.email);
 * }
 * ```
 */
export function getStateProp<S extends { readonly _tag: string }>(state: S) {
  return getStatePropRaw(state);
}

/**
 * Internal helpers for state property access.
 * @internal
 */
export { useGetStateRaw, getStatePropRaw };

/**
 * Get the current state from a context.
 *
 * @typeParam S - State type.
 * @param context - The context to read from.
 * @returns The current state value.
 *
 * @example
 * ```ts
 * const state = useStore(context);
 * console.log(state._tag);
 * ```
 */
export function useStore<S extends { readonly _tag: string }>(context: TagixContext<S>): S {
  return context.getCurrent();
}

/**
 * Extract a value from state using a selector function.
 *
 * @typeParam S - State type.
 * @typeParam T - What the selector returns.
 * @param context - The context to read from.
 * @param selector - Function that takes state and returns a derived value.
 * @returns The value from running the selector once.
 *
 * @example
 * ```ts
 * const userName = useSelector(context, (state) =>
 *   state._tag === "LoggedIn" ? state.name : null
 * );
 * ```
 */
export function useSelector<S extends { readonly _tag: string }, T>(
  context: TagixContext<S>,
  selector: (state: S) => T
): T {
  let value: T;
  const unsubscribe = context.select(selector, (newValue) => {
    value = newValue;
  });
  value = selector(context.getCurrent());
  unsubscribe();
  return value;
}

/**
 * Listen for state changes and run a callback each time.
 *
 * @typeParam S - State type.
 * @param context - The context to subscribe to.
 * @param callback - Function that runs whenever state changes.
 * @returns A cleanup function to stop listening.
 *
 * @example
 * ```ts
 * const unsubscribe = useSubscribe(context, (state) => {
 *   console.log("New state:", state);
 * });
 * ```
 */
export function useSubscribe<S extends { readonly _tag: string }>(
  context: TagixContext<S>,
  callback: (state: S) => void
): () => void {
  return context.subscribe(callback);
}

/**
 * Read one specific property from state.
 *
 * @typeParam S - State type.
 * @typeParam K - Property key to read.
 * @param context - The context to read from.
 * @param key - Which property to get.
 * @returns The property value or undefined if it does not exist.
 *
 * @example
 * ```ts
 * const count = useKey(context, "value");
 * ```
 */
export function useKey<S extends { readonly _tag: string }, K extends keyof S>(
  context: TagixContext<S>,
  key: K
): S[K] | undefined {
  return useSelector(context, (state) => state[key]);
}

/**
 * Get a dispatch function to send actions through a context.
 *
 * @typeParam S - State type.
 * @param context - The context to dispatch through.
 * @returns A function that sends actions.
 *
 * @example
 * ```ts
 * const dispatch = useDispatch(context);
 * dispatch("Increment", { amount: 1 });
 * ```
 */
export function useDispatch<S extends { readonly _tag: string }>(
  context: TagixContext<S>
): <TPayload>(type: string, payload: TPayload) => void | Promise<void> {
  return <TPayload>(type: string, payload: TPayload) => {
    return context.dispatch(type, payload);
  };
}

/**
 * Build a selector function that reads from state every time you call it.
 *
 * @typeParam S - State type.
 * @typeParam T - What the selector returns.
 * @param context - The context to read from.
 * @param selector - Function that extracts a value from state.
 * @returns A function you can call to get the current value.
 *
 * @example
 * ```ts
 * const getUserName = createSelector(context, (state) => state.user?.name);
 * const name = getUserName();
 * ```
 */
export function createSelector<S extends { readonly _tag: string }, T>(
  context: TagixContext<S>,
  selector: (state: S) => T
): () => T {
  return () => selector(context.getCurrent());
}
