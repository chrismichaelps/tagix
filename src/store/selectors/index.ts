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

interface Patchable<T> extends Function {
  (updates: Partial<T>): Patchable<T>;
  value: T;
}

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

export function getState<S extends { readonly _tag: string }, K extends S["_tag"]>(
  store: { stateValue: S },
  tag: K
): Option<Extract<S, { _tag: K }>> {
  const s = store.stateValue;
  return s._tag === tag ? some(s as Extract<S, { _tag: K }>) : none();
}

export function select<T extends object, K extends keyof T>(obj: T, key: K): T[K] | undefined {
  return key in obj ? obj[key] : undefined;
}

export function pluck<T extends object, K extends string>(key: K): (obj: T) => unknown {
  return (obj: T): unknown => {
    if (key.includes(".")) {
      const keys = key.split(".");
      let result: unknown = obj;
      for (const k of keys) {
        if (result === null || result === undefined) return undefined;
        result = (result as Record<string, unknown>)[k];
      }
      return result;
    }
    return (obj as Record<string, unknown>)[key];
  };
}

export function combineSelectors<T extends object, R1, R2>(
  selector1: (state: T) => R1,
  selector2: (state: T) => R2
): (state: T) => readonly [R1, R2];

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

export function memoize<T extends object, R>(selector: (input: T) => R): (input: T) => R {
  let lastInput: T | undefined;
  let lastResult: R | undefined;

  return (input: T): R => {
    if (lastInput !== undefined && Object.is(input, lastInput)) {
      return lastResult!;
    }
    lastInput = input;
    lastResult = selector(input);
    return lastResult;
  };
}

export function hasProperty<T extends object, K extends string>(
  obj: T,
  key: K
): obj is T & Record<K, unknown> {
  return key in obj;
}

export function getOrDefault<T>(defaultValue: T): (value: T | undefined) => T {
  return (value) => value ?? defaultValue;
}
