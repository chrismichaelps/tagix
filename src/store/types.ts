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
  /** Maximum number of snapshots to retain (LRU eviction). @default 10 */
  readonly maxSnapshots?: number;
  /** Maximum number of undo steps to retain (includes initial state). @default 100 */
  readonly maxUndoHistory?: number;
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
 */
export type Middleware<S extends { readonly _tag: string }> = (
  context: MiddlewareContext<S>
) => (next: (action: Action | AsyncAction) => void) => (action: Action | AsyncAction) => void;

/**
 * Snapshot of store state at a point in time.
 * @typeParam S - The state type.
 */
export interface Snapshot<S extends { readonly _tag: string }> {
  /** User-defined snapshot name. */
  readonly name: string;
  /** The state at snapshot time. */
  readonly state: S;
  /** Unix timestamp in milliseconds. */
  readonly timestamp: number;
}

/**
 * Definition for derived/computed values.
 * @typeParam TState - The source state type.
 * @typeParam TValue - The computed value type.
 */
export interface DerivedDefinition<TState extends { readonly _tag: string }, TValue> {
  /** Key used to identify the derived value. */
  readonly key: string;
  /** Computation function. */
  readonly compute: (state: TState) => TValue;
}

/** Callback invoked on state changes. @param state - The new state. */
export type SubscribeCallback<S extends { readonly _tag: string }> = (state: S) => void;

/** Callback invoked when a specific path in state changes. @param value - The new value at the path. */
export type SubscribePathCallback<T> = (value: T) => void;
