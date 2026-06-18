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
 * The result of a comparison: `-1` if the first value is less, `0` if equal,
 * `1` if the first value is greater.
 */
export type Ordering = -1 | 0 | 1;

/**
 * A total order over values of type `A`: a function comparing two values.
 *
 * @typeParam A - The type being compared.
 *
 * @remarks
 * `Order` values are composable comparators inspired by Effect's `Order` module.
 * Build primitive orders (`Order.number`, `Order.string`, ...), derive new ones
 * with `mapInput`/`reverse`, and chain tie-breakers with `combine`. They pair
 * naturally with selectors and derived state for sorting.
 *
 * @example
 * ```ts
 * interface User { name: string; age: number }
 *
 * const byAge = mapInput(number, (u: User) => u.age);
 * const byName = mapInput(string, (u: User) => u.name);
 *
 * // Sort by age, then by name as a tie-breaker.
 * const ordered = sort(combine(byAge, byName))(users);
 * ```
 */
export interface Order<A> {
  (self: A, that: A): Ordering;
}

const sign = (n: number): Ordering => (n < 0 ? -1 : n > 0 ? 1 : 0);

/**
 * Order for numbers, ascending.
 * @remarks `NaN` is treated as the greatest value and sorts last, keeping the
 * comparator a total order (plain `self - that` would report `NaN` as equal to
 * everything and corrupt sorting).
 */
export const number: Order<number> = (self, that) => {
  if (Number.isNaN(self)) return Number.isNaN(that) ? 0 : 1;
  if (Number.isNaN(that)) return -1;
  return sign(self - that);
};

/** Order for strings, by lexicographic comparison. */
export const string: Order<string> = (self, that) => (self < that ? -1 : self > that ? 1 : 0);

/** Order for booleans, with `false < true`. */
export const boolean: Order<boolean> = (self, that) => (self === that ? 0 : self < that ? -1 : 1);

/** Order for bigints, ascending. */
export const bigint: Order<bigint> = (self, that) => (self < that ? -1 : self > that ? 1 : 0);

/** Order for `Date` values, earliest first. */
export const date: Order<Date> = (self, that) => sign(self.getTime() - that.getTime());

/**
 * Reverses an order, swapping ascending for descending.
 * @typeParam A - The compared type.
 * @param O - The order to reverse.
 */
export function reverse<A>(O: Order<A>): Order<A> {
  return (self, that) => O(that, self);
}

/**
 * Derives an order on `B` from an order on `A` by extracting an `A` from each `B`.
 * @typeParam A - The comparable type.
 * @typeParam B - The input type.
 * @param O - The order on the extracted value.
 * @param f - Extracts the comparable value from the input.
 * @example
 * ```ts
 * const byAge = mapInput(number, (u: User) => u.age);
 * ```
 */
export function mapInput<A, B>(O: Order<A>, f: (b: B) => A): Order<B> {
  return (self, that) => O(f(self), f(that));
}

/**
 * Combines two orders: uses the first, falling back to the second on ties.
 * @typeParam A - The compared type.
 */
export function combine<A>(first: Order<A>, second: Order<A>): Order<A> {
  return (self, that) => {
    const result = first(self, that);
    return result !== 0 ? result : second(self, that);
  };
}

/**
 * Combines many orders left-to-right, each acting as a tie-breaker for the previous.
 * @typeParam A - The compared type.
 * @param orders - Orders applied in priority sequence.
 */
export function combineAll<A>(orders: ReadonlyArray<Order<A>>): Order<A> {
  return (self, that) => {
    for (const O of orders) {
      const result = O(self, that);
      if (result !== 0) return result;
    }
    return 0;
  };
}

/**
 * Lifts an order on elements to a lexicographic order on arrays of those elements.
 * Shorter arrays sort before longer ones when one is a prefix of the other.
 * @typeParam A - The element type.
 */
export function array<A>(O: Order<A>): Order<ReadonlyArray<A>> {
  return (self, that) => {
    const length = Math.min(self.length, that.length);
    for (let i = 0; i < length; i++) {
      const result = O(self[i], that[i]);
      if (result !== 0) return result;
    }
    return number(self.length, that.length);
  };
}

/** Returns a predicate testing whether `self < that` under the given order. */
export function lessThan<A>(O: Order<A>): (self: A, that: A) => boolean {
  return (self, that) => O(self, that) === -1;
}

/** Returns a predicate testing whether `self <= that` under the given order. */
export function lessThanOrEqualTo<A>(O: Order<A>): (self: A, that: A) => boolean {
  return (self, that) => O(self, that) !== 1;
}

/** Returns a predicate testing whether `self > that` under the given order. */
export function greaterThan<A>(O: Order<A>): (self: A, that: A) => boolean {
  return (self, that) => O(self, that) === 1;
}

/** Returns a predicate testing whether `self >= that` under the given order. */
export function greaterThanOrEqualTo<A>(O: Order<A>): (self: A, that: A) => boolean {
  return (self, that) => O(self, that) !== -1;
}

/** Returns a function selecting the lesser of two values (favoring `self` on ties). */
export function min<A>(O: Order<A>): (self: A, that: A) => A {
  return (self, that) => (O(self, that) === 1 ? that : self);
}

/** Returns a function selecting the greater of two values (favoring `self` on ties). */
export function max<A>(O: Order<A>): (self: A, that: A) => A {
  return (self, that) => (O(self, that) === -1 ? that : self);
}

/**
 * Returns a function clamping a value into the inclusive `[minimum, maximum]` range.
 * @typeParam A - The compared type.
 */
export function clamp<A>(O: Order<A>): (value: A, options: { minimum: A; maximum: A }) => A {
  return (value, { minimum, maximum }) => {
    if (O(value, minimum) === -1) return minimum;
    if (O(value, maximum) === 1) return maximum;
    return value;
  };
}

/**
 * Returns a predicate testing whether a value is within the inclusive
 * `[minimum, maximum]` range.
 * @typeParam A - The compared type.
 */
export function between<A>(
  O: Order<A>
): (value: A, options: { minimum: A; maximum: A }) => boolean {
  return (value, { minimum, maximum }) => O(value, minimum) !== -1 && O(value, maximum) !== 1;
}

/**
 * Returns a function that sorts an array under the given order, returning a new
 * array (the input is not mutated).
 * @typeParam A - The element type.
 */
export function sort<A>(O: Order<A>): (items: ReadonlyArray<A>) => A[] {
  return (items) => items.slice().sort(O);
}
