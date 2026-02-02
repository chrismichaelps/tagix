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
 * Configuration options for creating a TagixStore.
 * @typeParam S - The state type, must have a `_tag` property for state identification.
 */
export interface StoreConfig<S extends { readonly _tag: string }> {
  /** Human-readable name for debugging and DevTools. */
  readonly name?: string;
  /** When true, throws on invalid state transitions. */
  readonly strict?: boolean;
  /** Maximum number of errors to retain in history. @default 50 */
  readonly maxErrorHistory?: number;
  /** Maximum number of retries for failed async actions. @default 3 */
  readonly maxRetries?: number;
  /** Middleware chain for intercepting dispatches. */
  readonly middlewares?: Array<Middleware<S>>;
}

/**
 * Synchronous action definition.
 * @typeParam TPayload - The payload type passed during dispatch.
 * @typeParam TState - The state type this action operates on.
 */
export interface Action<TPayload = never, TState = never> {
  /** Unique action type identifier. */
  readonly type: string;
  /** Default payload template (overridden at dispatch time). */
  readonly payload: TPayload;
  /** State transition function. @param state - Current state. @param payload - Payload from dispatch call. @returns New state. */
  readonly handler: (state: TState, payload: TPayload) => TState;
}

/**
 * Asynchronous action with side effects.
 * @typeParam TPayload - The payload type.
 * @typeParam TState - The state type.
 * @typeParam TError - The error type thrown by the effect.
 */
export interface AsyncAction<TPayload = never, TState = never, TError = never> {
  /** Unique action type identifier. */
  readonly type: string;
  /** Default payload template. */
  readonly payload: TPayload;
  /** Pre-effect state update (runs immediately on dispatch). */
  readonly state: (currentState: TState) => TState;
  /** Side effect to execute (awaits completion). @param payload - Payload from dispatch. @returns Effect result. */
  readonly effect: (payload: TPayload) => Promise<unknown>;
  /** Success handler (runs after effect resolves). */
  readonly onSuccess: (currentState: TState, result: unknown) => TState;
  /** Error handler (runs if effect rejects or throws). */
  readonly onError: (currentState: TState, error: TError) => TState;
}

/**
 * Context object passed to middleware functions.
 * @typeParam S - The store's state type.
 */
export interface MiddlewareContext<S extends { readonly _tag: string }> {
  /** Returns the current state. */
  readonly getState: () => S;
  /** Dispatches an action with optional payload. */
  readonly dispatch: <TPayload>(type: string, payload: TPayload) => void;
  /** Subscribes to state changes. @returns Unsubscribe function. */
  readonly subscribe: (callback: (state: S) => void) => () => void;
}

/**
 * Middleware function that wraps action dispatch.
 * @param context - Store context for reading state or dispatching nested actions.
 * @returns A function that wraps the next middleware/handler.
 * @remarks The returned function should return `true` (or void) to proceed with action execution, or `false` to block.
 */
export type Middleware<S extends { readonly _tag: string }> = (
  context: MiddlewareContext<S>
) => (
  next: (action: Action | AsyncAction) => boolean
) => (action: Action | AsyncAction) => boolean | void;

/** Callback invoked on state changes. @param state - The new state. */
export type SubscribeCallback<S extends { readonly _tag: string }> = (state: S) => void;

/**
 * Callback invoked when a specific path in state changes. @param value - The new value at the path. */
export type SubscribePathCallback<T> = (value: T) => void;

/**
 * Type guard to check if a value is a Tagix Action.
 * @param value - Value to check.
 * @returns True if value is an Action.
 */
export function isAction(value: unknown): value is Action {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    "handler" in value &&
    !("effect" in value)
  );
}

/**
 * Type guard to check if a value is a Tagix AsyncAction.
 * @param value - Value to check.
 * @returns True if value is an AsyncAction.
 */
export function isAsyncAction(value: unknown): value is AsyncAction {
  return typeof value === "object" && value !== null && "type" in value && "effect" in value;
}

/**
 * Extracts the payload type from an Action or ActionCreator.
 * @typeParam T - The action or action creator type.
 */
export type PayloadOf<T> =
  T extends Action<infer P, any>
    ? P
    : T extends AsyncAction<infer P, any, any>
      ? P
      : T extends (payload: infer P) => Action<any, any>
        ? P
        : T extends (payload?: infer P) => AsyncAction<any, any, any>
          ? P
          : never;

/**
 * Extracts the state type from an Action or ActionCreator.
 * @typeParam T - The action or action creator type.
 */
export type StateOf<T> =
  T extends Action<any, infer S>
    ? S
    : T extends AsyncAction<any, infer S, any>
      ? S
      : T extends (payload: any) => Action<any, infer S>
        ? S
        : T extends (payload?: any) => AsyncAction<any, infer S, any>
          ? S
          : never;
