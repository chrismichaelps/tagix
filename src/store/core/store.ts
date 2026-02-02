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
import { tryCatch, tryCatchAsync, match } from "../../lib/Data/either";
import { some, none, type Option } from "../../lib/Data/option";
import type { TaggedEnumConstructor } from "../../lib/Data/tagged-enum";
import type {
  StoreConfig,
  Action,
  AsyncAction,
  SubscribeCallback,
  MiddlewareContext,
} from "../types";
import { DEFAULT_CONFIG, ACTION_TYPE_PREFIX } from "../constants";
import { StateTransitionError, ActionNotFoundError } from "../error";
import {
  getErrorCategory,
  getErrorInfo,
  isTagixError,
  isRecoverableError,
  type ErrorCategory,
  type TagixErrorObject,
} from "../error-names";

type StateTransitions<S extends { readonly _tag: string }> = Partial<
  Record<S["_tag"], (state: S, payload?: unknown) => S>
>;

/**
 * Core store implementation for Tagix state management.
 * @typeParam S - The state type, must be a discriminated union with `_tag` property.
 * @remarks Manages state transitions, subscriptions, and error tracking.
 */
export class TagixStore<S extends { readonly _tag: string }> {
  private state: S;
  private readonly stateConstructor: TaggedEnumConstructor<S>;
  private readonly actions: Map<string, Action | AsyncAction> = new Map();
  private readonly _errorHistory: Map<number, unknown> = new Map();
  private readonly _errorCountByCategory: Map<ErrorCategory, number> = new Map();
  private readonly subscribers: Set<SubscribeCallback<S>> = new Set();
  private readonly config: Required<StoreConfig<S>>;
  private readonly _validStateTags: Set<string>;
  private readonly _dispatchMiddleware: (action: Action | AsyncAction) => void;
  private _currentPayload: unknown = undefined;

  constructor(
    initialState: S,
    stateConstructor: TaggedEnumConstructor<S>,
    config: StoreConfig<S> = {}
  ) {
    this.state = initialState;
    this.stateConstructor = stateConstructor;
    this.config = { ...DEFAULT_CONFIG, ...config } as Required<StoreConfig<S>>;

    this._validStateTags = new Set();

    for (const key of Object.keys(initialState)) {
      if (key !== "_tag" && isFunction((stateConstructor as any)[key])) {
        this._validStateTags.add(key);
      }
    }

    if (this._validStateTags.size === 0) {
      this._validStateTags.add(initialState._tag);
    }

    const context: MiddlewareContext<S> = {
      getState: () => this.state,
      dispatch: (type, payload) => this.dispatch(type, payload),
      subscribe: (callback) => this.subscribe(callback),
    };

    const middlewares = this.config.middlewares || [];
    let next: (action: Action | AsyncAction) => void = (action) => this._executeAction(action);

    for (const middleware of middlewares.reverse()) {
      const mw = middleware(context);
      const currentNext = next;
      next = (action) => mw(currentNext)(action);
    }

    this._dispatchMiddleware = next;
  }

  /**
   * Current state value.
   * @remarks Read-only access to the current state. Use `dispatch` to modify state.
   */
  get stateValue(): S {
    return this.state;
  }

  /**
   * Store name from configuration.
   */
  get name(): string {
    return this.config.name;
  }

  /**
   * Most recent error from error history.
   * @returns The most recent error, or undefined if no errors occurred.
   */
  get lastError(): unknown | undefined {
    let lastError: unknown | undefined;
    let maxKey = -1;
    for (const [key, error] of this._errorHistory) {
      if (key > maxKey) {
        maxKey = key;
        lastError = error;
      }
    }
    return lastError;
  }

  /**
   * All errors recorded in history.
   * @remarks Limited by `maxErrorHistory` configuration.
   */
  get errorHistory(): readonly unknown[] {
    return Array.from(this._errorHistory.values());
  }

  /**
   * Store configuration with all defaults applied.
   */
  get configValue(): Readonly<Required<StoreConfig<S>>> {
    return this.config;
  }

  /**
   * All registered action type identifiers.
   */
  get registeredActions(): readonly string[] {
    return Array.from(this.actions.keys());
  }

  /**
   * Error code of the most recent error.
   * @returns The numeric error code, or undefined if no Tagix error occurred.
   */
  get lastErrorCode(): number | undefined {
    const error = this.lastError;
    if (isTagixError(error)) {
      const taggedError = error as TagixErrorObject;
      return taggedError.code;
    }
    return undefined;
  }

  /**
   * Error category of the most recent error.
   * @returns The error category, or undefined if no Tagix error occurred.
   */
  get lastErrorCategory(): ErrorCategory | undefined {
    const code = this.lastErrorCode;
    return code !== undefined ? getErrorCategory(code) : undefined;
  }

  /**
   * Whether the most recent error is recoverable.
   * @returns True if the error is in a recoverable category (STATE, ACTION, PAYLOAD).
   */
  get isLastErrorRecoverable(): boolean {
    const code = this.lastErrorCode;
    return code !== undefined ? isRecoverableError(code) : false;
  }

  /**
   * Extracts structured error information from an error.
   * @param error - The error to extract information from.
   * @returns TagixErrorObject if the error is a Tagix error, null otherwise.
   */
  getErrorInfo(error: unknown): TagixErrorObject | null {
    return getErrorInfo(error);
  }

  /**
   * Gets error counts grouped by category.
   * @returns A new Map with error counts per category.
   */
  getErrorCountByCategory(): Map<ErrorCategory, number> {
    return new Map(this._errorCountByCategory);
  }

  /**
   * Gets all errors in a specific category.
   * @param category - The error category to filter for.
   * @returns Array of errors in the specified category.
   */
  getErrorsByCategory(category: ErrorCategory): readonly unknown[] {
    const result: unknown[] = [];
    for (const error of this._errorHistory.values()) {
      if (isTagixError(error)) {
        const taggedError = error as TagixErrorObject;
        const errorCategory = getErrorCategory(taggedError.code);
        if (errorCategory === category) {
          result.push(error);
        }
      }
    }
    return result;
  }

  /**
   * Clears all error history and category counts.
   */
  clearErrorHistory(): void {
    this._errorHistory.clear();
    this._errorCountByCategory.clear();
  }

  /**
   * Total number of errors recorded.
   */
  getTotalErrorCount(): number {
    return this._errorHistory.size;
  }

  /**
   * Checks if any error with the given code exists in history.
   * @param code - The error code to check for.
   * @returns True if at least one error with this code exists.
   */
  hasErrorCode(code: number): boolean {
    for (const error of this._errorHistory.values()) {
      if (isTagixError(error)) {
        const taggedError = error as TagixErrorObject;
        if (taggedError.code === code) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Dispatches an action to update state.
   * @typeParam TPayload - The payload type for this dispatch.
   * @param type - The action type identifier (without prefix).
   * @param payload - The payload to pass to the action handler.
   * @returns Promise for async actions, void for sync actions.
   * @throws {ActionNotFoundError} If the action type is not registered.
   */
  dispatch<TPayload>(type: string, _payload: TPayload): void | Promise<void> {
    const action = this.actions.get(type);

    if (action === null || action === undefined) {
      throw new ActionNotFoundError({ type });
    }

    if ("effect" in action) {
      const asyncAction = action as unknown as AsyncAction<TPayload, S, unknown>;
      this._currentPayload = _payload;
      this._dispatchMiddleware(asyncAction as unknown as Action | AsyncAction);
      return this.handleAsyncAction(asyncAction, _payload);
    }

    const syncAction = action as unknown as Action<TPayload, S>;
    this._currentPayload = _payload;
    this._dispatchMiddleware(syncAction as unknown as Action | AsyncAction);
  }

  private _executeAction(action: Action | AsyncAction): void {
    if ("effect" in action) {
      return;
    }

    const syncAction = action as any as Action<any, S>;
    this.handleAction(syncAction, this._currentPayload as any);
  }

  private handleAction<TPayload>(action: Action<TPayload, S>, payload: TPayload): void {
    const result = tryCatch<S, Error>(
      () => action.handler(this.state, payload),
      (err) => (err instanceof Error ? err : new Error(String(err)))
    );

    match(result, {
      onLeft: (error: Error) => {
        this.recordError(error);
        throw error;
      },
      onRight: (newState: S) => {
        if (this.config.strict && !this._validStateTags.has(newState._tag)) {
          throw new StateTransitionError({
            expected: Array.from(this._validStateTags),
            actual: newState._tag,
            action: action.type,
          });
        }

        this.state = newState;
        this.notifySubscribers();
      },
    });
  }

  private async handleAsyncAction<TPayload>(
    action: AsyncAction<TPayload, S, unknown>,
    payload: TPayload
  ): Promise<void> {
    const maxRetries = this.config.maxRetries;
    let attempt = 0;
    let lastError: unknown;
    let currentState = this.state;

    while (attempt <= maxRetries) {
      currentState = action.state(currentState);
      if (attempt === 0) {
        this.state = currentState;
        this.notifySubscribers();
      }

      const result = await tryCatchAsync(
        () => action.effect(payload),
        (err) => err
      );

      const done = match(result, {
        onRight: (value) => {
          this.state = action.onSuccess(currentState, value);
          this.notifySubscribers();
          return true;
        },
        onLeft: (error) => {
          lastError = error;
          attempt++;
          if (attempt <= maxRetries) {
            currentState = action.onError(currentState, error);
          }
          return false;
        },
      });

      if (done) return;
    }

    this.state = action.onError(currentState, lastError!);
    this.recordError(lastError);
    this.notifySubscribers();
  }

  private recordError(error: unknown): void {
    const timestamp = Date.now();
    this._errorHistory.set(timestamp, error);

    if (isTagixError(error)) {
      const taggedError = error as TagixErrorObject;
      const category = getErrorCategory(taggedError.code);
      if (category) {
        const current = this._errorCountByCategory.get(category) ?? 0;
        this._errorCountByCategory.set(category, current + 1);
      }
    }

    if (this._errorHistory.size > this.config.maxErrorHistory) {
      const oldestTimestamp = this._errorHistory.keys().next().value;
      if (oldestTimestamp !== undefined) {
        const oldError = this._errorHistory.get(oldestTimestamp);
        if (isTagixError(oldError)) {
          const taggedOld = oldError as TagixErrorObject;
          const oldCategory = getErrorCategory(taggedOld.code);
          if (oldCategory) {
            const count = this._errorCountByCategory.get(oldCategory) ?? 1;
            if (count <= 1) {
              this._errorCountByCategory.delete(oldCategory);
            } else {
              this._errorCountByCategory.set(oldCategory, count - 1);
            }
          }
        }
        this._errorHistory.delete(oldestTimestamp);
      }
    }
  }

  private notifySubscribers(): void {
    for (const subscriber of this.subscribers) {
      subscriber(this.state);
    }
  }

  /**
   * Subscribes to state changes.
   * @param callback - Function called immediately with current state, then on each change.
   * @returns Unsubscribe function to remove the callback.
   */
  subscribe(callback: SubscribeCallback<S>): () => void {
    callback(this.state);
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Registers an action or async action with the store.
   * @typeParam TPayload - The payload type for this action.
   * @param type - The action type identifier (without prefix).
   * @param action - The action or async action to register.
   * @remarks Action type is automatically prefixed with `ACTION_TYPE_PREFIX`.
   */
  register<TPayload>(
    type: string,
    action: Action<TPayload, S> | AsyncAction<TPayload, S, any>
  ): void {
    this.actions.set(`${ACTION_TYPE_PREFIX}${type}`, action as unknown as Action | AsyncAction);
  }

  /**
   * Creates a transition function from a map of tag-specific handlers.
   * @param transitions - Map of state tag to transition function.
   * @returns A transition function that routes based on state tag.
   * @remarks Returns the state unchanged if no handler exists for the current tag.
   */
  transitions(transitions: StateTransitions<S>): (state: S, payload?: unknown) => S {
    return (state) => {
      const tag = state._tag as keyof StateTransitions<S>;
      const fn = transitions[tag];
      return fn ? fn(state) : state;
    };
  }

  /**
   * Checks if the current state has a specific tag.
   * @param tag - The state tag to check for.
   * @returns True if the current state's tag matches.
   */
  isInState(tag: S["_tag"]): boolean {
    return this.state._tag === tag;
  }

  /**
   * Gets the current state if it matches the specified tag.
   * @typeParam K - The state tag type to extract.
   * @param tag - The state tag to match.
   * @returns Some(state) if tag matches, None otherwise.
   */
  getState<K extends S["_tag"]>(tag: K): Option<Extract<S, { _tag: K }>> {
    return this.state._tag === tag ? some(this.state as Extract<S, { _tag: K }>) : none();
  }

  /**
   * Selects a property from the current state.
   * @typeParam K - The property key type.
   * @param key - The property key to access.
   * @returns The property value, or undefined if not present.
   *
   * @remarks
   * For properties that exist on all variants, the return type is correctly inferred.
   * For properties that may not exist on all variants, returns `unknown | undefined`.
   */
  select<K extends string>(key: K): K extends keyof S ? S[K] : unknown | undefined {
    return key in this.state
      ? ((this.state as Record<string, unknown>)[key] as K extends keyof S
          ? S[K]
          : unknown | undefined)
      : (undefined as K extends keyof S ? S[K] : unknown | undefined);
  }
}
