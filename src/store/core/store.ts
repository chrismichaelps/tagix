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

import { tryCatch, tryCatchAsync, match } from "../../lib/Data/either";
import { some, none, type Option } from "../../lib/Data/option";
import { TaggedEnumConstructor } from "../../lib/Data/tagged-enum";
import { isFunction, hasProperty } from "../../lib/Data/predicate";
import {
  StoreConfig,
  Action,
  AsyncAction,
  SubscribeCallback,
  isAsyncAction,
  MiddlewareContext,
} from "../types";
import { DEFAULT_CONFIG, ACTION_TYPE_PREFIX } from "../constants";
import { StateTransitionError, ActionNotFoundError, InvalidActionError } from "../error";
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

/** Union type for storing heterogeneous actions in a Map */
type AnyAction = Action<any, any> | AsyncAction<any, any, any>;

/**
 * Core store implementation for Tagix state management.
 * @typeParam S - The state type, must be a discriminated union with `_tag` property.
 * @remarks Manages state transitions, subscriptions, and error tracking.
 */
export class TagixStore<S extends { readonly _tag: string }> {
  private state: S;
  private readonly _initialState: S;
  private readonly stateConstructor: TaggedEnumConstructor<S>;
  private readonly actions: Map<string, AnyAction> = new Map();
  private readonly _errorHistory: Map<number, unknown> = new Map();
  private readonly _errorCountByCategory: Map<ErrorCategory, number> = new Map();
  private readonly _errorCodeIndex: Map<number, number> = new Map();
  private readonly _errorsByCategoryIndex: Map<ErrorCategory, unknown[]> = new Map();
  private _dispatchContext: unknown = null;
  private readonly subscribers: Set<SubscribeCallback<S>> = new Set();
  private readonly config: Required<StoreConfig<S>>;
  private readonly _validStateTags: Set<string>;
  private readonly _dispatchMiddleware: (action: AnyAction) => boolean;
  private _currentPayload: unknown = undefined;
  private _errorTimestampCounter: number = 0;
  private _lastErrorKey: number = -1;
  private _lastErrorValue: unknown | undefined = undefined;
  private _actionsDirty: boolean = false;
  private _cachedActionKeys: readonly string[] = [];
  private _cachedActionsMap: ReadonlyMap<string, AnyAction> = new Map();
  // Re-entrancy guard: while subscribers are being notified, any nested
  // notify (from a subscriber that calls dispatch) is pushed onto the queue
  // and flushed after the current pass — instead of recursing into the stack,
  // which otherwise runs ~hundreds of frames deep and overflows.
  private _notifying: boolean = false;
  private _pendingNotifications: number = 0;

  constructor(
    initialState: S,
    stateConstructor: TaggedEnumConstructor<S>,
    config: StoreConfig<S> = {}
  ) {
    this.state = initialState;
    this._initialState = initialState;
    this.stateConstructor = stateConstructor;
    this.config = { ...DEFAULT_CONFIG, ...config } as Required<StoreConfig<S>>;

    this._validStateTags = new Set();

    const stateCtor = stateConstructor as TaggedEnumConstructor<S> & { State?: object };
    if (stateCtor.State) {
      for (const key of Object.keys(stateCtor.State)) {
        this._validStateTags.add(key);
      }
    }

    if (this._validStateTags.size === 0) {
      for (const key of Object.keys(initialState)) {
        if (key === "_tag") continue;
        const ctor = stateConstructor as { [key: string]: unknown };
        if (hasProperty(ctor, key) && isFunction(ctor[key])) {
          this._validStateTags.add(key);
        }
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
    let next: (action: AnyAction) => boolean = (_action) => {
      this._executeAction(_action);
      return true;
    };

    // Copy before reversing — `this.config.middlewares` is the caller's array
    // reference (spread copies the reference, not the array), and reversing in
    // place would corrupt the order for any other store sharing that array.
    for (const middleware of [...middlewares].reverse()) {
      const mw = middleware(context);
      const currentNext = next;
      const bridgedNext = currentNext as unknown as (action: Action | AsyncAction) => boolean;
      next = (action) => {
        const result = mw(bridgedNext)(action as unknown as Action | AsyncAction);
        return result !== false;
      };
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
    return this._lastErrorValue;
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
    if (this._actionsDirty) {
      this._cachedActionKeys = Array.from(this.actions.keys());
      this._cachedActionsMap = new Map(this.actions);
      this._actionsDirty = false;
    }
    return this._cachedActionKeys;
  }

  /**
   * Get the state constructor used by this store.
   */
  getStateConstructor(): TaggedEnumConstructor<S> {
    return this.stateConstructor;
  }

  /**
   * Get all registered actions.
   */
  getActions(): ReadonlyMap<string, AnyAction> {
    if (this._actionsDirty) {
      this._cachedActionKeys = Array.from(this.actions.keys());
      this._cachedActionsMap = new Map(this.actions);
      this._actionsDirty = false;
    }
    return this._cachedActionsMap;
  }

  /**
   * @internal
   * Sets the context for the current dispatch operation.
   */
  _setDispatchContext(context: unknown): void {
    this._dispatchContext = context;
  }

  /**
   * @internal
   * Gets the context for the current dispatch operation.
   */
  _getDispatchContext(): unknown {
    return this._dispatchContext;
  }

  /**
   * @internal
   * Clears the dispatch context after dispatch completes.
   */
  _clearDispatchContext(): void {
    this._dispatchContext = null;
  }

  /**
   * Error code of the most recent error.
   * @returns The numeric error code, or undefined if no Tagix error occurred.
   */
  get lastErrorCode(): number | undefined {
    const error = this.lastError;
    if (isTagixError(error)) {
      return error.code;
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
    return this._errorsByCategoryIndex.get(category) ?? [];
  }

  /**
   * Clears all error history and category counts.
   */
  clearErrorHistory(): void {
    this._errorHistory.clear();
    this._errorCountByCategory.clear();
    this._errorCodeIndex.clear();
    this._errorsByCategoryIndex.clear();
    this._lastErrorKey = -1;
    this._lastErrorValue = undefined;
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
    return (this._errorCodeIndex.get(code) ?? 0) > 0;
  }

  /**
   * Dispatches an action. Supports multiple patterns:
   * 1. String-based: dispatch("action/type", payload)
   * 2. Action object: dispatch(actionObject) or dispatch(actionObject, payload)
   * 3. Action group reference: dispatch(UserActions.login, payload)
   * @param typeOrAction - Action type string, action object from group, or action group member.
   * @param payload - Optional payload for the action (uses action's default payload if not provided).
   * @returns void for sync actions, Promise for async actions.
   */
  dispatch<T = unknown>(typeOrAction: string | object, payload?: T): void | Promise<void> {
    if (typeof typeOrAction === "string") {
      return this._dispatchByType(typeOrAction, payload);
    }

    if (typeof typeOrAction === "function") {
      const action = (typeOrAction as (payload?: T) => object)(payload);
      return this._dispatchAction(action as AnyAction, payload);
    }

    const actionObj = typeOrAction as AnyAction;
    if (("type" in actionObj && "handler" in actionObj) || "effect" in actionObj) {
      const effectivePayload = payload !== undefined ? payload : actionObj.payload;
      return this._dispatchAction(actionObj, effectivePayload);
    }

    return this._dispatchAction(typeOrAction as AnyAction, payload);
  }

  private _dispatchByType(type: string, _payload: unknown): void | Promise<void> {
    const prefixedType = type.startsWith(ACTION_TYPE_PREFIX)
      ? type
      : `${ACTION_TYPE_PREFIX}${type}`;

    const action = this.actions.get(prefixedType);

    if (action === null || action === undefined) {
      return this._recordAndThrow(new ActionNotFoundError({ type: prefixedType }));
    }

    return this._dispatchAction(action, _payload);
  }

  private _dispatchAction(action: AnyAction, _payload: unknown): void | Promise<void> {
    const invalidAsyncAction = this._getInvalidAsyncActionInfo(action);
    if (invalidAsyncAction) {
      return this._recordAndThrow(new InvalidActionError(invalidAsyncAction));
    }

    if (isAsyncAction(action)) {
      const merged = Object.assign({}, action, { payload: _payload });
      const asyncAction = merged as unknown as AsyncAction<unknown, S, unknown>;
      this._currentPayload = _payload;
      const shouldProceed = this._dispatchMiddleware(merged);
      if (shouldProceed === false) {
        return;
      }
      const actionPayload = hasProperty(merged, "payload") ? merged.payload : undefined;
      const isValidPayload =
        actionPayload !== undefined && !(typeof actionPayload === "number" && isNaN(actionPayload));
      const effectivePayload = isValidPayload ? actionPayload : _payload;
      return this.handleAsyncAction(asyncAction, effectivePayload);
    }

    this._currentPayload = _payload;
    this._dispatchMiddleware(action);
  }

  private _executeAction(action: AnyAction): void {
    const invalidAsyncAction = this._getInvalidAsyncActionInfo(action);
    if (invalidAsyncAction) {
      throw new InvalidActionError(invalidAsyncAction);
    }

    if (isAsyncAction(action)) {
      return;
    }

    this.handleAction(action as unknown as Action<unknown, S>, this._currentPayload);
  }

  private _getInvalidAsyncActionInfo(
    action: AnyAction
  ): { action: string; reason: string; message: string } | null {
    if (action === null || typeof action !== "object") {
      return null;
    }

    const obj = action;
    if (!("effect" in obj)) {
      return null;
    }

    if (isAsyncAction(action)) {
      return null;
    }

    const actionType = typeof obj.type === "string" ? obj.type : "unknown";
    return {
      action: actionType,
      reason: "effect property must be a function",
      message: `Invalid async action '${actionType}': effect property must be a function`,
    };
  }

  private _assertValidState(newState: S, action: string): void {
    if (this.config.strict && !this._validStateTags.has(newState._tag)) {
      throw new StateTransitionError({
        expected: Array.from(this._validStateTags),
        actual: newState._tag,
        action,
      });
    }
  }

  private _recordAndThrow(error: unknown): never {
    this.recordError(error);
    throw error;
  }

  private handleAction<TPayload>(action: Action<TPayload, S>, payload: TPayload): void {
    const context = this._dispatchContext;
    const handler =
      context && action.handlerWithContext
        ? (state: S, p: TPayload) => action.handlerWithContext!(state, p, context)
        : action.handler;

    const result = tryCatch<S, Error>(
      () => handler(this.state, payload),
      (err) => (err instanceof Error ? err : new Error(String(err)))
    );

    this._clearDispatchContext();

    match(result, {
      onLeft: (error: Error) => {
        this.recordError(error);
      },
      onRight: (newState: S) => {
        try {
          this._assertValidState(newState, action.type);
          this.state = newState;
          this.notifySubscribers();
        } catch (error) {
          this._recordAndThrow(error);
        }
      },
    });
  }

  private async handleAsyncAction<TPayload>(
    action: AsyncAction<TPayload, S, unknown>,
    payload: TPayload
  ): Promise<void> {
    try {
      const maxRetries = this.config.maxRetries;
      const context = this._dispatchContext;
      let attempt = 0;
      let lastError: unknown;
      const baselineState = this.state;
      let pendingState = action.state(baselineState);

      this._assertValidState(pendingState, action.type);
      this.state = pendingState;
      this.notifySubscribers();

      while (attempt <= maxRetries) {
        const result = await tryCatchAsync(
          () => action.effect(payload, context),
          (err) => err
        );

        const done = match(result, {
          onRight: (value) => {
            const freshState = this.state;
            const mergedState = this._mergeAsyncState(freshState, value, action.onSuccess, context);
            this._assertValidState(mergedState, action.type);
            this.state = mergedState;
            this.notifySubscribers();
            return true;
          },
          onLeft: (error) => {
            lastError = error;
            attempt++;
            if (attempt <= maxRetries) {
              const freshState = this.state;
              pendingState = action.onError(freshState, error, context);
              this._assertValidState(pendingState, action.type);
              this.state = pendingState;
              this.notifySubscribers();
            }
            return false;
          },
        });

        if (done) {
          return;
        }
      }

      const freshState = this.state;
      const mergedState = this._mergeAsyncState(freshState, lastError, action.onError, context);
      this._assertValidState(mergedState, action.type);
      this.state = mergedState;
      this.recordError(lastError);
      this.notifySubscribers();
    } catch (error) {
      this.recordError(error);
      throw error;
    } finally {
      this._clearDispatchContext();
    }
  }

  private _mergeAsyncState(
    freshState: S,
    handlerInput: unknown,
    handler: (state: S, input: unknown, context: unknown) => S,
    context: unknown
  ): S {
    return handler(freshState, handlerInput, context);
  }

  private recordError(error: unknown): void {
    this._errorTimestampCounter++;
    const timestamp = Date.now() * 1000 + (this._errorTimestampCounter % 1000);
    this._errorHistory.set(timestamp, error);

    this._lastErrorKey = timestamp;
    this._lastErrorValue = error;

    if (isTagixError(error)) {
      const code = error.code;
      const category = getErrorCategory(code);

      this._errorCodeIndex.set(code, (this._errorCodeIndex.get(code) ?? 0) + 1);

      if (category) {
        const current = this._errorCountByCategory.get(category) ?? 0;
        this._errorCountByCategory.set(category, current + 1);

        const categoryErrors = this._errorsByCategoryIndex.get(category);
        if (categoryErrors) {
          categoryErrors.push(error);
        } else {
          this._errorsByCategoryIndex.set(category, [error]);
        }
      }
    }

    if (this._errorHistory.size > this.config.maxErrorHistory) {
      const oldestTimestamp = this._errorHistory.keys().next().value;
      if (oldestTimestamp !== undefined) {
        const oldError = this._errorHistory.get(oldestTimestamp);
        if (isTagixError(oldError)) {
          const oldCode = oldError.code;
          const oldCategory = getErrorCategory(oldCode);

          const codeCount = this._errorCodeIndex.get(oldCode) ?? 1;
          if (codeCount <= 1) {
            this._errorCodeIndex.delete(oldCode);
          } else {
            this._errorCodeIndex.set(oldCode, codeCount - 1);
          }

          if (oldCategory) {
            const count = this._errorCountByCategory.get(oldCategory) ?? 1;
            if (count <= 1) {
              this._errorCountByCategory.delete(oldCategory);
            } else {
              this._errorCountByCategory.set(oldCategory, count - 1);
            }

            const categoryErrors = this._errorsByCategoryIndex.get(oldCategory);
            if (categoryErrors) {
              const idx = categoryErrors.indexOf(oldError);
              if (idx !== -1) {
                categoryErrors.splice(idx, 1);
              }
              if (categoryErrors.length === 0) {
                this._errorsByCategoryIndex.delete(oldCategory);
              }
            }
          }
        }
        this._errorHistory.delete(oldestTimestamp);
      }
    }
  }

  private notifySubscribers(): void {
    // A notification pass is already running: record that a deferred flush is
    // needed and return. The active pass will pick it up instead of recursing
    // synchronously (which otherwise runs hundreds of frames deep and overflows).
    if (this._notifying) {
      this._pendingNotifications++;
      return;
    }

    this._notifying = true;
    let flushPasses = 0;
    try {
      // Flush passes: the initial notification plus any deferred ones. Each
      // pass holds _notifying true so nested notify calls defer rather than
      // recurse. A flush may schedule further passes, so loop until drained
      // — but cap iterations to prevent an infinite synchronous loop when a
      // subscriber dispatches unconditionally (a user-side infinite loop).
      const maxFlushPasses = 100;
      do {
        if (this._pendingNotifications > 0) {
          this._pendingNotifications--;
        }
        flushPasses++;
        const currentState = this.state;
        for (const subscriber of this.subscribers) {
          try {
            subscriber(currentState);
          } catch (error) {
            this.recordError(error);
          }
        }
      } while (this._pendingNotifications > 0 && flushPasses < maxFlushPasses);

      // If deferred notifications remain after hitting the cap, a subscriber
      // is dispatching unconditionally — break the cycle and record a warning.
      if (this._pendingNotifications > 0) {
        const discarded = this._pendingNotifications;
        this._pendingNotifications = 0;
        this.recordError(
          new Error(
            `Notification cycle detected: ${discarded} deferred notification(s) discarded after ${maxFlushPasses} flush passes. A subscriber is dispatching on every notification.`
          )
        );
      }
    } finally {
      this._notifying = false;
    }
  }

  /**
   * Subscribes to state changes.
   * @param callback - Function called immediately with current state, then on each change.
   * @returns Unsubscribe function to remove the callback.
   */
  subscribe(callback: SubscribeCallback<S>): () => void {
    try {
      callback(this.state);
    } catch (error) {
      this.recordError(error);
    }
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
  register(type: string, action: AnyAction): void {
    this.actions.set(`${ACTION_TYPE_PREFIX}${type}`, action);
    this._actionsDirty = true;
  }

  /**
   * Registers all actions from an action group.
   * @param group - Action group created by `createActionGroup`.
   * @remarks Each action in the group has its type prefixed with the namespace.
   */
  registerGroup(group: Record<string, AnyAction>): void {
    for (const action of Object.values(group)) {
      this.actions.set(action.type, action);
    }
    this._actionsDirty = true;
  }

  /**
   * Creates a transition function from a map of tag-specific handlers.
   * @param transitions - Map of state tag to transition function.
   * @returns A transition function that routes based on state tag.
   * @remarks Returns the state unchanged if no handler exists for the current tag.
   */
  transitions(transitions: StateTransitions<S>): (state: S, payload?: unknown) => S {
    return (state, payload) => {
      const tag = state._tag as keyof StateTransitions<S>;
      const fn = transitions[tag];
      return fn ? fn(state, payload) : state;
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
   * Selects a value from the current state using a type-safe accessor function.
   * @typeParam R - The accessed value type.
   * @param accessor - Function that reads the desired value from the state.
   * @returns The accessed value, or `undefined` if traversal hits a nullish value.
   *
   * @remarks
   * Prefer this form — it is fully type-checked, supports nested access, and gives
   * editor autocomplete: `store.select(s => s.user.name)`.
   * @example
   * ```ts
   * const count = store.select(s => s.count); // number | undefined
   * ```
   */
  select<R>(accessor: (state: S) => R): R | undefined;
  /**
   * Selects a property from the current state by key.
   * @deprecated Use a function accessor for full type-safety and autocomplete:
   * `store.select(s => s.key)`. String keys are not checked for nested paths.
   */
  select<K extends string>(key: K): K extends keyof S ? S[K] : unknown | undefined;
  select(keyOrAccessor: string | ((state: S) => unknown)): unknown {
    if (typeof keyOrAccessor === "function") {
      try {
        return keyOrAccessor(this.state);
      } catch {
        return undefined;
      }
    }
    if (hasProperty(this.state, keyOrAccessor)) {
      return this.state[keyOrAccessor];
    }
    return undefined;
  }

  /**
   * Directly sets the store state.
   * @param newState - The new state to set.
   * @param notify - Whether to notify subscribers of the change (default: true).
   * @remarks This method bypasses action dispatch and validation. Use with caution.
   * Primarily intended for restoring state from forks or persisted state.
   */
  setState(newState: S, notify: boolean = true): void {
    try {
      this._assertValidState(newState, "setState");
    } catch (error) {
      this._recordAndThrow(error);
    }
    this.state = newState;
    if (notify) {
      this.notifySubscribers();
    }
  }

  /**
   * Resets the store to the initial state it was created with.
   * @param notify - Whether to notify subscribers of the change (default: true).
   * @remarks
   * Restores the exact `initialState` passed to `createStore`. Useful for logout,
   * "clear" flows, and resetting between tests. Like `setState`, this bypasses
   * action dispatch; error history is left intact (use `clearErrorHistory` to reset it).
   */
  reset(notify: boolean = true): void {
    this.state = this._initialState;
    if (notify) {
      this.notifySubscribers();
    }
  }
}
