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

export const isStringPayload = isString;
export const isNumberPayload = isNumber;
export const isBooleanPayload = isBoolean;
export const isRecordPayload = isRecord;
export const isArrayPayload = isArray;
export const isPlainObjectPayload = isPlainObject;

export function notEmptyString(value: unknown): value is string {
  return isNonEmptyString(value);
}

export function positiveNumber(value: unknown): value is number {
  return isPositiveNumber(value);
}

export function nonEmptyArray<A>(value: unknown): value is A[] {
  return isNonEmptyArray<A>(value);
}

export function fromPayload<P>(): (payload: P | undefined) => P {
  return (payload) => {
    if (payload === null || payload === undefined) {
      throw new RequiredPayloadError({});
    }
    return payload;
  };
}

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

export function on<T extends { readonly _tag: string }, K extends T["_tag"]>(
  _tag: K
): <R>(f: (state: Extract<T, { _tag: K }>) => R) => (state: T) => R | undefined {
  return (f) => (state) => (state._tag === _tag ? f(state as Extract<T, { _tag: K }>) : undefined);
}

export function when<T extends { readonly _tag: string }, K extends T["_tag"]>(
  _tag: K
): Refinement<T, Extract<T, { _tag: K }>> {
  return (state): state is Extract<T, { _tag: K }> => state._tag === _tag;
}

export function withState<S extends { readonly _tag: string }, K extends S["_tag"], R>(
  state: S,
  tag: K,
  fn: (s: Extract<S, { _tag: typeof tag }>) => R
): R | undefined {
  return state._tag === tag ? fn(state as Extract<S, { _tag: typeof tag }>) : undefined;
}

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

export function isInState<S extends { readonly _tag: string }>(
  store: { stateValue: S },
  tag: S["_tag"]
): boolean {
  return store.stateValue._tag === tag;
}

export function getTag<S extends { readonly _tag: string }>(state: S): S["_tag"] {
  return state._tag;
}

export function hasTag<S extends { readonly _tag: string }>(state: S, tag: S["_tag"]): boolean {
  return state._tag === tag;
}
