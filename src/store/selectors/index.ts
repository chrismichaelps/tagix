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

import { some, none, type Option } from "../../lib/Data/option";
import { isNullish, isRecord } from "../../lib/Data/predicate";

interface Patchable<T> extends Function {
  (updates: Partial<T>): Patchable<T>;
  value: T;
}

function enumerableKeys(value: object): Array<string | symbol> {
  return [
    ...Object.keys(value),
    ...Object.getOwnPropertySymbols(value).filter((symbol) =>
      Object.prototype.propertyIsEnumerable.call(value, symbol)
    ),
  ];
}

/**
 * Creates an immutable patching function for objects.
 * @typeParam T - The object type.
 * @param base - The base object to patch.
 * @returns A chainable patching function with a `value` property.
 * @remarks Each call returns a new object, enabling immutable updates.
 * @example
 * ```ts
 * const patcher = patch({ a: 1, b: 2 });
 * const result = patcher({ b: 3 })({ c: 4 }).value;
 * // result = { a: 1, b: 3, c: 4 }
 * ```
 */
export function patch<T extends object>(base: T): Patchable<T> {
  const fn: Patchable<T> = Object.assign(
    (updates: Partial<T>): Patchable<T> => {
      const newBase = { ...fn.value, ...updates } as T;
      return patch(newBase);
    },
    { value: base }
  );
  return fn;
}

/**
 * Gets state from a store if it matches the specified tag.
 * @typeParam S - The state type.
 * @typeParam K - The state tag type.
 * @param store - The store instance.
 * @param tag - The state tag to match.
 * @returns Some(state) if tag matches, None otherwise.
 */
export function getState<S extends { readonly _tag: string }, K extends S["_tag"]>(
  store: { stateValue: S },
  tag: K
): Option<Extract<S, { _tag: K }>> {
  const s = store.stateValue;
  return s._tag === tag ? some(s as Extract<S, { _tag: K }>) : none();
}

/**
 * Selects a property from an object.
 * @typeParam T - The object type.
 * @typeParam K - The property key type.
 * @param obj - The object to select from.
 * @param key - The property key.
 * @returns The property value, or undefined if not present.
 */
export function select<T extends object, K extends keyof T>(obj: T, key: K): T[K] | undefined {
  return key in obj ? obj[key] : undefined;
}

/**
 * Creates a function that plucks a property (or nested property) from an object.
 * @typeParam T - The object type.
 * @typeParam K - The property path type (supports dot notation).
 * @param key - The property key or dot-separated path (e.g., "user.name").
 * @returns A function that extracts the value at the path.
 * @remarks Returns undefined if any part of the path is null/undefined.
 */
export function pluck<T extends object, K extends string>(key: K): (obj: T) => unknown {
  if (!key.includes(".")) {
    return (obj: T): unknown => (hasProperty(obj, key) ? obj[key] : undefined);
  }

  const keys = key.split(".");

  return (obj: T): unknown => {
    let current: unknown = obj;
    for (const k of keys) {
      if (isNullish(current) || !isRecord(current)) return undefined;
      current = current[k];
    }
    return current;
  };
}

/**
 * Combines multiple selectors into a single selector returning a tuple.
 * @typeParam T - The input state type.
 * @typeParam R1 - The first selector return type.
 * @typeParam R2 - The second selector return type.
 * @param selector1 - First selector function.
 * @param selector2 - Second selector function.
 * @returns A selector that returns a tuple of results.
 * @remarks Overloaded for 2 or 3 selectors.
 */
export function combineSelectors<T extends object, R1, R2>(
  selector1: (state: T) => R1,
  selector2: (state: T) => R2
): (state: T) => readonly [R1, R2];

/**
 * Combines three selectors into a single selector returning a tuple.
 * @typeParam T - The input state type.
 * @typeParam R1 - The first selector return type.
 * @typeParam R2 - The second selector return type.
 * @typeParam R3 - The third selector return type.
 * @param selector1 - First selector function.
 * @param selector2 - Second selector function.
 * @param selector3 - Third selector function.
 * @returns A selector that returns a tuple of three results.
 */
export function combineSelectors<T extends object, R1, R2, R3>(
  selector1: (state: T) => R1,
  selector2: (state: T) => R2,
  selector3: (state: T) => R3
): (state: T) => readonly [R1, R2, R3];

export function combineSelectors<T extends object, R1, R2, R3>(
  selector1: (state: T) => R1,
  selector2: (state: T) => R2,
  selector3?: (state: T) => R3
): (state: T) => readonly [R1, R2] | readonly [R1, R2, R3] {
  if (selector3) {
    return (state) => [selector1(state), selector2(state), selector3(state)];
  }
  return (state) => [selector1(state), selector2(state)];
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;

  if (typeof a !== "object" || typeof b !== "object") return false;

  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }

  if (a instanceof RegExp || b instanceof RegExp) {
    return a instanceof RegExp && b instanceof RegExp && String(a) === String(b);
  }

  if (a instanceof Map || b instanceof Map) {
    if (!(a instanceof Map) || !(b instanceof Map)) return false;
    if (a.size !== b.size) return false;
    for (const [key, value] of a) {
      if (!b.has(key) || !deepEqual(value, b.get(key))) return false;
    }
    return true;
  }

  if (a instanceof Set || b instanceof Set) {
    if (!(a instanceof Set) || !(b instanceof Set)) return false;
    if (a.size !== b.size) return false;
    const unmatched = Array.from(b);
    for (const valueA of a) {
      const matchIndex = unmatched.findIndex((valueB) => deepEqual(valueA, valueB));
      if (matchIndex === -1) return false;
      unmatched.splice(matchIndex, 1);
    }
    return true;
  }

  if (ArrayBuffer.isView(a) || ArrayBuffer.isView(b)) {
    if (!ArrayBuffer.isView(a) || !ArrayBuffer.isView(b)) return false;
    if (a.constructor !== b.constructor || a.byteLength !== b.byteLength) return false;
    const bytesA = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
    const bytesB = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
    return bytesA.every((byte, index) => byte === bytesB[index]);
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => deepEqual(val, b[idx]));
  }

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;

  const keysA = enumerableKeys(a);
  const keysB = enumerableKeys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => key in b && deepEqual(a[key as keyof typeof a], b[key as keyof typeof b]));
}

/**
 * Memoizes a selector function using deep equality comparison.
 * @typeParam T - The input type.
 * @typeParam R - The return type.
 * @param selector - The selector function to memoize.
 * @returns A memoized version that returns cached result for equal input values.
 * @remarks Uses deep equality for comparison. Cache invalidates when input values change structurally.
 */
export function memoize<T extends object, R>(selector: (input: T) => R): (input: T) => R {
  let lastInput: T | undefined;
  let lastResult: R | undefined;

  return (input: T): R => {
    if (lastInput !== undefined && deepEqual(input, lastInput)) {
      return lastResult!;
    }
    lastInput = input;
    lastResult = selector(input);
    return lastResult;
  };
}

/**
 * Type guard that checks if an object has a specific property.
 * @typeParam T - The object type.
 * @typeParam K - The property key type.
 * @param obj - The object to check.
 * @param key - The property key to check for.
 * @returns True if the object has the property, narrowing the type.
 */
export function hasProperty<T extends object, K extends string>(
  obj: T,
  key: K
): obj is T & Record<K, unknown> {
  return key in obj;
}

/**
 * Creates a function that returns a default value if input is undefined.
 * @typeParam T - The value type.
 * @param defaultValue - The default value to use.
 * @returns A function that returns the input value or the default.
 */
export function getOrDefault<T>(defaultValue: T): (value: T | undefined) => T {
  return (value) => value ?? defaultValue;
}
