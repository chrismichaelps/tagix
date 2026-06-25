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

import { type Either, left, right } from "./either";

declare const BrandTypeId: unique symbol;

/**
 * A nominal "brand" applied to an underlying type `T`, distinguished by a unique
 * `Name`. Two brands over the same base type are not assignable to each other,
 * giving you compile-time-distinct types for things like ids and units that are
 * structurally identical at runtime.
 *
 * Brands compose: `Brand<number, "Int"> & Brand<number, "Positive">` is a value
 * that is both, and is assignable to either.
 *
 * @typeParam T - The underlying runtime type.
 * @typeParam Name - The unique brand name.
 *
 * @example
 * ```ts
 * type UserId = Brand<string, "UserId">;
 * type OrderId = Brand<string, "OrderId">;
 *
 * declare const u: UserId;
 * const s: string = u;   // ok — a UserId is still a string
 * const o: OrderId = u;  // type error — distinct brands
 * ```
 */
export type Brand<T, Name extends string> = T & {
  readonly [BrandTypeId]: { readonly [K in Name]: Name };
};

/**
 * Creates a zero-cost constructor for a nominal brand with no validation.
 * The returned function is the identity at runtime; it only refines the type.
 *
 * @typeParam A - The underlying base type.
 * @typeParam Name - The brand name.
 * @returns A constructor `(value: A) => Brand<A, Name>`.
 *
 * @example
 * ```ts
 * type UserId = Brand<string, "UserId">;
 * const UserId = nominal<string, "UserId">();
 * const id = UserId("u_123"); // UserId
 * ```
 */
export function nominal<A, Name extends string>(): (value: A) => Brand<A, Name> {
  return (value) => value as Brand<A, Name>;
}

/**
 * Creates a validating constructor for a branded type. Returns `Right(branded)`
 * when the predicate holds, otherwise `Left(onFailure(value))`.
 *
 * @typeParam A - The underlying base type.
 * @typeParam Name - The brand name.
 * @typeParam E - The failure type produced by `onFailure`.
 * @param predicate - Validates the underlying value.
 * @param onFailure - Builds the failure value when validation fails.
 * @returns A constructor `(value: A) => Either<E, Brand<A, Name>>`.
 *
 * @example
 * ```ts
 * type Email = Brand<string, "Email">;
 * const Email = refined<string, "Email", string>(
 *   (s) => s.includes("@"),
 *   (s) => `invalid email: ${s}`
 * );
 * Email("a@b.com"); // Right(Email)
 * Email("nope");    // Left("invalid email: nope")
 * ```
 */
export function refined<A, Name extends string, E>(
  predicate: (value: A) => boolean,
  onFailure: (value: A) => E
): (value: A) => Either<E, Brand<A, Name>> {
  return (value) => (predicate(value) ? right(value as Brand<A, Name>) : left(onFailure(value)));
}

/**
 * Builds a type guard for a branded type from a runtime predicate. Narrows an
 * unbranded value to the brand when the predicate holds.
 *
 * @typeParam T - The underlying type.
 * @typeParam Name - The brand name.
 * @param predicate - Validates the underlying value.
 * @returns A type predicate `(value: T) => value is Brand<T, Name>`.
 *
 * @example
 * ```ts
 * const isInt = is<number, "Int">(Number.isInteger);
 * if (isInt(n)) {
 *   // n is Brand<number, "Int"> here
 * }
 * ```
 */
export function is<T, Name extends string>(
  predicate: (value: T) => boolean
): (value: T) => value is Brand<T, Name> {
  return (value): value is Brand<T, Name> => predicate(value);
}
