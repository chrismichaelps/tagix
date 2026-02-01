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

import { isFunction } from "../../lib/Data/predicate";
import { NonExhaustiveMatchError } from "../error";

/**
 * Pattern matches on state, executing the handler for the matching tag.
 * @typeParam S - The state type.
 * @typeParam R - The return type.
 * @param state - The state to match on.
 * @param cases - Object mapping state tags to handlers.
 * @returns The handler result, or undefined if no handler exists for the tag.
 * @remarks Non-exhaustive: missing tags return undefined.
 */
export function matchState<S extends { readonly _tag: string }, R>(
  state: S,
  cases: { [K in S["_tag"]]?: (value: Extract<S, { _tag: K }>) => R }
): R | undefined {
  const tag = state._tag as S["_tag"];
  const handler = cases[tag];
  if (!handler) return undefined;

  const taggedState = state as Extract<S, { _tag: typeof tag }>;
  return handler(taggedState);
}

/**
 * Exhaustive pattern matching on state, requiring handlers for all tags.
 * @typeParam S - The state type.
 * @typeParam R - The return type.
 * @param state - The state to match on.
 * @param cases - Object mapping all state tags to handlers.
 * @returns The handler result for the matching tag.
 * @throws {NonExhaustiveMatchError} If no handler exists for the state tag.
 * @remarks Enforces compile-time exhaustiveness via type system.
 */
export function exhaust<S extends { readonly _tag: string }, R>(
  state: S,
  cases: { [K in S["_tag"]]: (value: Extract<S, { _tag: K }>) => R }
): R {
  const tag = state._tag as S["_tag"];
  const handler = cases[tag];
  if (!isFunction(handler)) {
    throw new NonExhaustiveMatchError({ tag: state._tag });
  }

  const taggedState = state as Extract<S, { _tag: typeof tag }>;
  return handler(taggedState);
}
