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

import type { Refinement } from "../../lib/Data/predicate";
import type { Predicate } from "../../lib/Data/predicate";
import {
  isString,
  isNumber,
  isBoolean,
  isRecord,
  isArray,
  isPlainObject,
  isNonEmptyString,
  isPositiveNumber,
  isNonEmptyArray,
} from "../../lib/Data/predicate";

import { RequiredPayloadError, PayloadValidationError, UnexpectedStateError } from "../error";

export type { Predicate, Refinement };

/**
 * Type guard for string payloads.
 */
export const isStringPayload = isString;
/**
 * Type guard for number payloads.
 */
export const isNumberPayload = isNumber;
/**
 * Type guard for boolean payloads.
 */
export const isBooleanPayload = isBoolean;
/**
 * Type guard for record/object payloads.
 */
export const isRecordPayload = isRecord;
/**
 * Type guard for array payloads.
 */
export const isArrayPayload = isArray;
/**
 * Type guard for plain object payloads (not arrays, dates, etc.).
 */
export const isPlainObjectPayload = isPlainObject;

/**
 * Type guard for non-empty strings.
 * @param value - The value to check.
 * @returns True if value is a non-empty string.
 */
export function notEmptyString(value: unknown): value is string {
  return isNonEmptyString(value);
}

/**
 * Type guard for positive numbers.
 * @param value - The value to check.
 * @returns True if value is a positive number.
 */
export function positiveNumber(value: unknown): value is number {
  return isPositiveNumber(value);
}

/**
 * Type guard for non-empty arrays.
 * @typeParam A - The array element type.
 * @param value - The value to check.
 * @returns True if value is a non-empty array.
 */
export function nonEmptyArray<A>(value: unknown): value is A[] {
  return isNonEmptyArray<A>(value);
}

/**
 * Creates a function that extracts a required payload, throwing if missing.
 * @typeParam P - The payload type.
 * @returns A function that throws `RequiredPayloadError` if payload is null/undefined.
 */
export function fromPayload<P>(): (payload: P | undefined) => P {
  return (payload) => {
    if (payload === null || payload === undefined) {
      throw new RequiredPayloadError({});
    }
    return payload;
  };
}

/**
 * Creates a payload validator that throws if validation fails.
 * @typeParam T - The payload type.
 * @param predicate - The validation predicate.
 * @param errorMessage - Optional custom error message.
 * @returns A function that throws `PayloadValidationError` if predicate returns false.
 */
export function validatePayload<T>(
  predicate: Predicate<T>,
  errorMessage?: string
): (payload: T) => void {
  return (payload) => {
    if (!predicate(payload)) {
      throw new PayloadValidationError({
        message: errorMessage || "Payload validation failed",
      });
    }
  };
}

/**
 * Creates a function that executes only when state matches a specific tag.
 * @typeParam T - The state type.
 * @typeParam K - The state tag type.
 * @param _tag - The state tag to match.
 * @returns A function that returns undefined if tag doesn't match, otherwise executes the handler.
 */
export function on<T extends { readonly _tag: string }, K extends T["_tag"]>(
  _tag: K
): <R>(f: (state: Extract<T, { _tag: K }>) => R) => (state: T) => R | undefined {
  return (f) => (state) => (state._tag === _tag ? f(state as Extract<T, { _tag: K }>) : undefined);
}

/**
 * Creates a type guard that narrows state to a specific tag.
 * @typeParam T - The state type.
 * @typeParam K - The state tag type.
 * @param _tag - The state tag to match.
 * @returns A refinement function that narrows the state type.
 */
export function when<T extends { readonly _tag: string }, K extends T["_tag"]>(
  _tag: K
): Refinement<T, Extract<T, { _tag: K }>> {
  return (state): state is Extract<T, { _tag: K }> => state._tag === _tag;
}

/**
 * Executes a function with state if it matches the specified tag.
 * @typeParam S - The state type.
 * @typeParam K - The state tag type.
 * @typeParam R - The return type.
 * @param state - The state to check.
 * @param tag - The state tag to match.
 * @param fn - The function to execute if tag matches.
 * @returns The function result, or undefined if tag doesn't match.
 */
export function withState<S extends { readonly _tag: string }, K extends S["_tag"], R>(
  state: S,
  tag: K,
  fn: (s: Extract<S, { _tag: typeof tag }>) => R
): R | undefined {
  return state._tag === tag ? fn(state as Extract<S, { _tag: typeof tag }>) : undefined;
}

/**
 * Ensures store state matches a specific tag, throwing if it doesn't.
 * @typeParam S - The state type.
 * @typeParam K - The state tag type.
 * @param store - The store instance.
 * @param tag - The expected state tag.
 * @returns The narrowed state.
 * @throws {UnexpectedStateError} If state tag doesn't match.
 */
export function ensureState<S extends { readonly _tag: string }, K extends S["_tag"]>(
  store: { stateValue: S },
  tag: K
): Extract<S, { _tag: K }> {
  const state = store.stateValue;
  if (state._tag !== tag) {
    throw new UnexpectedStateError({ expected: tag, actual: state._tag });
  }
  return state as Extract<S, { _tag: K }>;
}

/**
 * Checks if store state has a specific tag.
 * @typeParam S - The state type.
 * @param store - The store instance.
 * @param tag - The state tag to check for.
 * @returns True if state tag matches.
 */
export function isInState<S extends { readonly _tag: string }>(
  store: { stateValue: S },
  tag: S["_tag"]
): boolean {
  return store.stateValue._tag === tag;
}

/**
 * Gets the tag from a state value.
 * @typeParam S - The state type.
 * @param state - The state value.
 * @returns The state tag.
 */
export function getTag<S extends { readonly _tag: string }>(state: S): S["_tag"] {
  return state._tag;
}

/**
 * Checks if a state value has a specific tag.
 * @typeParam S - The state type.
 * @param state - The state value.
 * @param tag - The tag to check for.
 * @returns True if state tag matches.
 */
export function hasTag<S extends { readonly _tag: string }>(state: S, tag: S["_tag"]): boolean {
  return state._tag === tag;
}
