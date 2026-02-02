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

/**
 * Safely gets a property value from a tagged union state.
 * Returns the value if present, otherwise returns the default value.
 *
 * @typeParam S - The state type (tagged union).
 * @typeParam K - The property key.
 * @typeParam D - The default value type.
 * @param state - The current state.
 * @param key - The property key to access.
 * @param defaultValue - The default value if property doesn't exist.
 * @returns The property value or the default.
 *
 * @example
 * ```ts
 * // In an action handler, safely access 'value' which may not exist on all variants:
 * const increment = createAction<{ amount: number }, CounterState>("Increment")
 *   .withPayload({ amount: 1 })
 *   .withState((s, p) => ({
 *     ...s,
 *     value: getValue(s, "value", 0) + p.amount,
 *   }));
 * ```
 */
export function getValue<S extends { readonly _tag: string }, K extends string, D>(
  state: S,
  key: K,
  defaultValue: D
): K extends keyof S ? S[K] : D {
  return key in state
    ? ((state as Record<string, unknown>)[key] as K extends keyof S ? S[K] : D)
    : (defaultValue as K extends keyof S ? S[K] : D);
}

/**
 * Type-safe property accessor for tagged union states.
 * Returns undefined if the property doesn't exist on the current variant.
 *
 * @typeParam S - The state type.
 * @typeParam K - The property key.
 * @param state - The current state.
 * @param key - The property key to access.
 * @returns The property value or undefined.
 */
export function getProperty<S extends { readonly _tag: string }, K extends string>(
  state: S,
  key: K
): K extends keyof S ? S[K] : undefined {
  return key in state
    ? ((state as Record<string, unknown>)[key] as K extends keyof S ? S[K] : undefined)
    : (undefined as K extends keyof S ? S[K] : undefined);
}

/**
 * Creates a state updater that preserves variant-specific properties.
 * Use this when updating properties that may not exist on all variants.
 *
 * @typeParam S - The state type.
 * @param state - The current state.
 * @param updates - Object with properties to update.
 * @returns The updated state.
 *
 * @example
 * ```ts
 * const increment = createAction<{ amount: number }, CounterState>("Increment")
 *   .withPayload({ amount: 1 })
 *   .withState((s, p) => updateState(s, {
 *     value: getValue(s, "value", 0) + p.amount
 *   }));
 * ```
 */
export function updateState<S extends { readonly _tag: string }>(
  state: S,
  updates: Partial<Record<string, unknown>>
): S {
  return { ...state, ...updates } as S;
}

/**
 * Narrows the state to a specific variant if it matches the given tag.
 * Returns undefined if the state is not the specified variant.
 *
 * @typeParam S - The full state union type.
 * @typeParam K - The tag to narrow to.
 * @param state - The current state.
 * @param tag - The tag to check for.
 * @returns The narrowed state or undefined.
 */
export function asVariant<S extends { readonly _tag: string }, K extends S["_tag"]>(
  state: S,
  tag: K
): Extract<S, { _tag: K }> | undefined {
  return state._tag === tag ? (state as Extract<S, { _tag: K }>) : undefined;
}
