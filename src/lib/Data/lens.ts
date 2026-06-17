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

import { identity } from "./functions";

/**
 * A composable, immutable lens focusing a value of type `A` inside a structure `S`.
 *
 * @typeParam S - The whole structure type.
 * @typeParam A - The focused value type.
 *
 * @remarks
 * Lenses are first-class, type-safe optics for reading and immutably updating
 * deeply nested values. They replace fragile string-path accessors with composable
 * functions that carry full type information and editor autocomplete.
 *
 * Both `set` and `modify` are *dual*: call them data-first (`lens.set(state, value)`)
 * for direct use, or data-last (`lens.set(value)`) to produce a reusable `S => S`
 * updater that composes with `pipe`/`flow`.
 *
 * @example
 * ```ts
 * interface State { user: { name: string; age: number } }
 *
 * const nameLens = lens<State>().at("user").at("name");
 *
 * nameLens.get(state);                // string
 * nameLens.set(state, "Ada");         // new State, data-first
 * pipe(state, nameLens.set("Ada"));   // new State, data-last
 * nameLens.modify(state, s => s.trim());
 * ```
 */
export interface Lens<S, A> {
  /** Reads the focused value out of the structure. */
  readonly get: (s: S) => A;

  /**
   * Immutably replaces the focused value.
   * @remarks Dual: `set(s, value)` (data-first) or `set(value)` (data-last `S => S`).
   */
  readonly set: {
    (s: S, value: A): S;
    (value: A): (s: S) => S;
  };

  /**
   * Immutably transforms the focused value with a function.
   * @remarks Dual: `modify(s, f)` (data-first) or `modify(f)` (data-last `S => S`).
   */
  readonly modify: {
    (s: S, f: (a: A) => A): S;
    (f: (a: A) => A): (s: S) => S;
  };

  /**
   * Focuses a property of the currently focused value, producing a deeper lens.
   * @typeParam K - The property key of `A` to focus.
   */
  readonly at: <K extends keyof A>(key: K) => Lens<S, A[K]>;

  /**
   * Composes this lens with another lens focused inside `A`.
   * @typeParam B - The value focused by the inner lens.
   */
  readonly compose: <B>(other: Lens<A, B>) => Lens<S, B>;
}

function makeLens<S, A>(get: (s: S) => A, replace: (s: S, value: A) => S): Lens<S, A> {
  const set = ((...args: [S, A] | [A]): S | ((s: S) => S) => {
    if (args.length === 2) {
      return replace(args[0], args[1]);
    }
    const [value] = args;
    return (s: S) => replace(s, value);
  }) as Lens<S, A>["set"];

  const modify = ((...args: [S, (a: A) => A] | [(a: A) => A]): S | ((s: S) => S) => {
    if (args.length === 2) {
      const [s, f] = args;
      return replace(s, f(get(s)));
    }
    const [f] = args;
    return (s: S) => replace(s, f(get(s)));
  }) as Lens<S, A>["modify"];

  const at = <K extends keyof A>(key: K): Lens<S, A[K]> =>
    makeLens<S, A[K]>(
      (s) => get(s)[key],
      (s, value) => {
        const focused = get(s);
        return replace(s, { ...focused, [key]: value });
      }
    );

  const compose = <B>(other: Lens<A, B>): Lens<S, B> =>
    makeLens<S, B>(
      (s) => other.get(get(s)),
      (s, value) => replace(s, other.set(get(s), value))
    );

  return { get, set, modify, at, compose };
}

/**
 * Creates the identity lens for a structure `S` — the starting point for building
 * deeper lenses with `.at(...)` or `.compose(...)`.
 *
 * @typeParam S - The structure type to focus into.
 * @returns A `Lens<S, S>` focusing the whole structure.
 *
 * @example
 * ```ts
 * const ageLens = lens<State>().at("user").at("age");
 * ageLens.modify(state, n => n + 1);
 * ```
 */
export function lens<S>(): Lens<S, S> {
  return makeLens<S, S>(identity, (_s, value) => value);
}

/**
 * Creates a lens focusing a single top-level property of `S`.
 * Shorthand for `lens<S>().at(key)`.
 *
 * @typeParam S - The structure type.
 * @typeParam K - The property key to focus.
 * @param key - The property to focus.
 * @returns A `Lens<S, S[K]>`.
 *
 * @example
 * ```ts
 * const countLens = prop<State, "count">("count");
 * countLens.modify(state, n => n + 1);
 * ```
 */
export function prop<S, K extends keyof S>(key: K): Lens<S, S[K]> {
  return lens<S>().at(key);
}
