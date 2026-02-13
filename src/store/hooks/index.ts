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
import type { Action, AsyncAction } from "../types";

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

/**
 * Match cases constraint — each key is a variant tag and each value is a handler
 * receiving the narrowed variant. The return type of each handler can differ;
 * the overall result is the union of all handler return types.
 */
type ExhaustiveMatchCases<S extends { readonly _tag: string }> = {
  [K in S["_tag"]]: (value: Extract<S, { _tag: K }>) => any;
};

/**
 * Partial match cases constraint for non-exhaustive pattern matching.
 */
type PartialMatchCases<S extends { readonly _tag: string }> = {
  [K in S["_tag"]]?: (value: Extract<S, { _tag: K }>) => any;
};

/**
 * Typed dispatch interface for action-object and legacy string-based dispatch.
 */
interface TypedDispatch<S extends { readonly _tag: string }> {
  /** Dispatch a sync action with a typed payload. */
  <TPayload>(action: Action<TPayload, S>, payload: TPayload): void;
  /** Dispatch an async action with a typed payload. */
  <TPayload, TEffect>(action: AsyncAction<TPayload, S, TEffect>, payload: TPayload): Promise<void>;
  /** Dispatch an action object reference without explicit payload (uses action's default payload). */
  (action: Action<never, S> | AsyncAction<never, S, unknown>): void | Promise<void>;
  /**
   * Legacy string-based dispatch. Prefer action-object dispatch for type safety.
   * @deprecated Use action object reference instead of string type identifier.
   */
  <TPayload>(type: string, payload: TPayload): void | Promise<void>;
}

/**
 * Typed dispatch interface for an action group, mapping group keys to typed dispatchers.
 */
type GroupDispatch<T extends Record<string, Action<any, any> | AsyncAction<any, any, any>>> = {
  [K in keyof T]: T[K] extends AsyncAction<infer P, any, any>
    ? (payload: P) => Promise<void>
    : T[K] extends Action<infer P, any>
      ? (payload: P) => void
      : never;
};

/**
 * Exhaustive pattern match on the current state of a context.
 * Every variant tag must be handled — the compiler enforces exhaustiveness.
 * Return type is the union of all handler return types.
 *
 * @typeParam S - State type with tagged enum structure.
 * @typeParam Cases - Object mapping every state tag to a handler (inferred).
 * @param context - The context to read from.
 * @param cases - Object mapping every state tag to a handler.
 * @returns The result of the matching handler.
 *
 * @example
 * ```ts
 * const name = useMatch(context, {
 *   LoggedIn: (s) => s.name,    // string
 *   LoggedOut: () => null,       // null
 * });
 * // name: string | null
 * ```
 */
export function useMatch<
  S extends { readonly _tag: string },
  Cases extends ExhaustiveMatchCases<S>,
>(context: TagixContext<S>, cases: Cases): ReturnType<Cases[S["_tag"]]> {
  const state = context.getCurrent();
  const tag = state._tag as S["_tag"];
  const handler = (cases as any)[tag] as (value: any) => ReturnType<Cases[S["_tag"]]>;
  return handler(state);
}

/**
 * Non-exhaustive pattern match on the current state of a context.
 * Only handles the variants you specify — unhandled variants return `undefined`.
 * Return type is the union of all provided handler return types, plus `undefined`.
 *
 * @typeParam S - State type with tagged enum structure.
 * @typeParam Cases - Partial object mapping state tags to handlers (inferred).
 * @param context - The context to read from.
 * @param cases - Object mapping some state tags to handlers.
 * @returns The result of the matching handler, or `undefined` if no handler matches.
 *
 * @example
 * ```ts
 * const greeting = useMatchPartial(context, {
 *   LoggedIn: (s) => `Welcome, ${s.name}`,
 * });
 * // greeting: string | undefined
 * ```
 */
export function useMatchPartial<
  S extends { readonly _tag: string },
  Cases extends PartialMatchCases<S>,
>(context: TagixContext<S>, cases: Cases): ReturnType<NonNullable<Cases[keyof Cases]>> | undefined {
  const state = context.getCurrent();
  const tag = state._tag as S["_tag"];
  const handler = cases[tag];
  if (!handler) return undefined;
  return handler(state as any);
}

/**
 * Narrow the current state to a single variant by tag.
 * Returns the variant's properties (without `_tag`) if matched, `undefined` otherwise.
 *
 * @typeParam S - State type with tagged enum structure.
 * @typeParam K - The variant tag to narrow to.
 * @param context - The context to read from.
 * @param tag - The variant tag to check for.
 * @returns The variant's props (without `_tag`), or `undefined` if state doesn't match.
 *
 * @example
 * ```ts
 * const user = useWhen(context, "LoggedIn");
 * if (user) {
 *   console.log(user.name);
 *   console.log(user.email);
 * }
 * ```
 */
export function useWhen<S extends { readonly _tag: string }, K extends S["_tag"]>(
  context: TagixContext<S>,
  tag: K
): Omit<Extract<S, { _tag: K }>, "_tag"> | undefined {
  const state = context.getCurrent();
  if (state._tag === tag) {
    const { _tag, ...props } = state as Extract<S, { _tag: K }>;
    return props as Omit<Extract<S, { _tag: K }>, "_tag">;
  }
  return undefined;
}

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
 * Get a typed dispatch function to send actions through a context.
 * Supports action-object dispatch (recommended) and legacy string-based dispatch.
 *
 * @typeParam S - State type.
 * @param context - The context to dispatch through.
 * @returns A typed dispatch function.
 *
 * @example
 * ```ts
 * const dispatch = useDispatch(context);
 *
 * // Typed dispatch with action reference (recommended)
 * dispatch(login, { username: "chris" });
 *
 * // Legacy string-based dispatch (deprecated)
 * dispatch("Login", { username: "chris" });
 * ```
 */
export function useDispatch<S extends { readonly _tag: string }>(
  context: TagixContext<S>
): TypedDispatch<S> {
  const dispatch = <TPayload>(typeOrAction: string | object, payload?: TPayload) => {
    return context.dispatch(typeOrAction, payload);
  };
  return dispatch as TypedDispatch<S>;
}

/**
 * Create a typed dispatch function from an action group.
 * Each key in the group becomes a typed method on the returned object.
 *
 * @typeParam S - State type.
 * @typeParam T - The action group record type.
 * @param context - The context to dispatch through.
 * @param group - An action group created via `createActionGroup`.
 * @returns An object with typed dispatch methods matching the group keys.
 *
 * @example
 * ```ts
 * const UserActions = createActionGroup("Auth", { login, logout });
 * const dispatch = useActionGroup(context, UserActions);
 *
 * dispatch.login({ username: "chris" });  // fully typed
 * dispatch.logout({});                     // fully typed
 * ```
 */
export function useActionGroup<
  S extends { readonly _tag: string },
  T extends Record<string, Action<any, any> | AsyncAction<any, any, any>>,
>(context: TagixContext<S>, group: T): GroupDispatch<T> {
  const result = {} as Record<string, (payload: unknown) => void | Promise<void>>;

  for (const key of Object.keys(group)) {
    const action = group[key];
    result[key] = (payload: unknown) => {
      return context.dispatch(action, payload);
    };
  }

  return result as GroupDispatch<T>;
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
 * @deprecated Use `useMatch`, `useMatchPartial`, or `useWhen` instead for better DX.
 *
 * @example
 * ```ts
 * // DEPRECATED — use useMatch instead:
 * // const name = useMatch(context, { LoggedIn: (s) => s.name, LoggedOut: () => null });
 *
 * const getUserState = useGetState<UserStateType>();
 * const name = getUserState(context)("LoggedIn", "name");
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
 * @deprecated Use `$match` on the tagged enum constructor or `useMatch`/`useWhen` hooks instead.
 *
 * @example
 * ```ts
 * // DEPRECATED — use $match instead:
 * // const name = UserState.$match(state, { LoggedIn: (s) => s.name, LoggedOut: () => null });
 *
 * const name = getStateProp(state)("LoggedIn", "name");
 * ```
 */
export function getStateProp<S extends { readonly _tag: string }>(state: S) {
  return getStatePropRaw(state);
}

/**
 * Read one specific property from state.
 *
 * @typeParam S - State type.
 * @typeParam K - Property key to read.
 * @param context - The context to read from.
 * @param key - Which property to get.
 * @returns The property value or undefined if it does not exist.
 * @deprecated Use `useWhen` or `useMatch` instead — they enforce variant awareness.
 *
 * @example
 * ```ts
 * // DEPRECATED — use useWhen instead:
 * // const user = useWhen(context, "LoggedIn");
 * // if (user) console.log(user.name);
 *
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
 * Internal helpers for state property access.
 * @internal
 */
export { useGetStateRaw, getStatePropRaw };
