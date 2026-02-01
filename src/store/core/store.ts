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
import { tryCatch, tryCatchAsync, isLeft } from "../../lib/Data/either";
import { some, none, type Option } from "../../lib/Data/option";
import type { TaggedEnumConstructor } from "../../lib/Data/tagged-enum";
import type {
  StoreConfig,
  Action,
  AsyncAction,
  Snapshot,
  SubscribeCallback,
  MiddlewareContext,
} from "../types";
import { DEFAULT_CONFIG, ACTION_TYPE_PREFIX } from "../constants";
import { StateTransitionError, ActionNotFoundError, SnapshotNotFoundError } from "../error";
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

interface LRUCacheEntry<T> {
  value: T;
  accessTime: number;
}

export class TagixStore<S extends { readonly _tag: string }> {
  private state: S;
  private readonly stateConstructor: TaggedEnumConstructor<S>;
  private readonly actions: Map<string, Action | AsyncAction> = new Map();
  private readonly history: S[] = [];
  private readonly snapshots: Map<string, LRUCacheEntry<Snapshot<S>>> = new Map();
  private readonly _errorHistory: Map<number, unknown> = new Map();
  private readonly _errorCountByCategory: Map<ErrorCategory, number> = new Map();
  private readonly subscribers: Set<SubscribeCallback<S>> = new Set();
  private undoIndex: number = -1;
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
    this.history.push(initialState);
    this.undoIndex = -1;

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

  get stateValue(): S {
    return this.state;
  }

  get name(): string {
    return this.config.name;
  }

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

  get errorHistory(): readonly unknown[] {
    return Array.from(this._errorHistory.values());
  }

  get currentHistory(): readonly S[] {
    return this.history.slice(0, this.undoIndex + 1);
  }

  get historyLength(): number {
    return this.history.length;
  }

  get undoIndexValue(): number {
    return this.undoIndex;
  }

  get configValue(): Readonly<Required<StoreConfig<S>>> {
    return this.config;
  }

  get snapshotNames(): readonly string[] {
    return Array.from(this.snapshots.keys());
  }

  get registeredActions(): readonly string[] {
    return Array.from(this.actions.keys());
  }

  get lastErrorCode(): number | undefined {
    const error = this.lastError;
    if (isTagixError(error)) {
      const taggedError = error as TagixErrorObject;
      return taggedError.code;
    }
    return undefined;
  }

  get lastErrorCategory(): ErrorCategory | undefined {
    const code = this.lastErrorCode;
    return code !== undefined ? getErrorCategory(code) : undefined;
  }

  get isLastErrorRecoverable(): boolean {
    const code = this.lastErrorCode;
    return code !== undefined ? isRecoverableError(code) : false;
  }

  getErrorInfo(error: unknown): TagixErrorObject | null {
    return getErrorInfo(error);
  }

  getErrorCountByCategory(): Map<ErrorCategory, number> {
    return new Map(this._errorCountByCategory);
  }

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

  clearErrorHistory(): void {
    this._errorHistory.clear();
    this._errorCountByCategory.clear();
  }

  getTotalErrorCount(): number {
    return this._errorHistory.size;
  }

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

  canUndo(): boolean {
    return this.undoIndex > 0;
  }

  canRedo(): boolean {
    return this.undoIndex < this.history.length - 1;
  }

  dispatch<TPayload>(type: string, payload: TPayload): void | Promise<void> {
    const action = this.actions.get(type);

    if (action === null || action === undefined) {
      throw new ActionNotFoundError({ type });
    }

    this._currentPayload = payload;

    if ("effect" in action) {
      const asyncAction = action as unknown as AsyncAction<TPayload, S, unknown>;
      this._dispatchMiddleware(asyncAction as unknown as Action | AsyncAction);
      return this.handleAsyncAction(asyncAction, payload);
    }

    const syncAction = action as unknown as Action<TPayload, S>;
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

    if (isLeft(result)) {
      this.recordError(result.left);
      throw result.left;
    }

    const newState = result.right;

    if (this.config.strict && !this._validStateTags.has(newState._tag)) {
      throw new StateTransitionError({
        expected: Array.from(this._validStateTags),
        actual: newState._tag,
        action: action.type,
      });
    }

    this.state = newState;
    this.addToHistory(newState);
    this.notifySubscribers();
  }

  private async handleAsyncAction<TPayload>(
    action: AsyncAction<TPayload, S, unknown>,
    payload: TPayload
  ): Promise<void> {
    this.state = action.state(this.state);
    this.notifySubscribers();

    const result = await tryCatchAsync(
      () => action.effect(payload),
      (err) => err
    );

    if (isLeft(result)) {
      this.state = action.onError(this.state, result.left);
      this.recordError(result.left);
      this.notifySubscribers();
      return;
    }

    this.state = action.onSuccess(this.state, result.right);
    this.addToHistory(this.state);
    this.notifySubscribers();
  }

  private addToHistory(newState: S): void {
    this.history.push(newState);
    this.undoIndex = this.history.length - 1;

    const maxHistory = this.config.maxUndoHistory;
    if (maxHistory > 0) {
      while (this.history.length > maxHistory + 1) {
        this.history.shift();
        this.undoIndex = this.history.length - 1;
      }
    }
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

  undo(): void {
    if (this.undoIndex <= 0) {
      if (this.undoIndex === 0) {
        this.state = this.history[0];
        this.undoIndex = -1;
        this.notifySubscribers();
      }
      return;
    }
    this.undoIndex--;
    this.state = this.history[this.undoIndex];
    this.notifySubscribers();
  }

  redo(): void {
    if (!this.canRedo()) return;
    this.undoIndex++;
    this.state = this.history[this.undoIndex];
    this.notifySubscribers();
  }

  snapshot(name: string): void {
    const isUpdate = this.snapshots.has(name);

    const entry: LRUCacheEntry<Snapshot<S>> = {
      value: {
        name,
        state: this.state,
        timestamp: Date.now(),
      },
      accessTime: Date.now(),
    };

    this.snapshots.set(name, entry);

    if (!isUpdate && this.snapshots.size > this.config.maxSnapshots) {
      let oldestName: string | undefined;
      let oldestTime = Infinity;

      for (const [snapName, snapEntry] of this.snapshots) {
        if (snapEntry.accessTime < oldestTime) {
          oldestTime = snapEntry.accessTime;
          oldestName = snapName;
        }
      }

      if (oldestName) {
        this.snapshots.delete(oldestName);
      }
    }
  }

  restore(name: string): void {
    const entry = this.snapshots.get(name);

    if (entry === undefined) {
      throw new SnapshotNotFoundError({
        name,
        available: Array.from(this.snapshots.keys()),
      });
    }

    entry.accessTime = Date.now();
    this.state = entry.value.state;
    this.notifySubscribers();
  }

  subscribe(callback: SubscribeCallback<S>): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  register<TPayload>(
    type: string,
    action: Action<TPayload, S> | AsyncAction<TPayload, S, any>
  ): void {
    this.actions.set(`${ACTION_TYPE_PREFIX}${type}`, action as unknown as Action | AsyncAction);
  }

  transitions(transitions: StateTransitions<S>): (state: S, payload?: unknown) => S {
    return (state) => {
      const tag = state._tag as keyof StateTransitions<S>;
      const fn = transitions[tag];
      return fn ? fn(state) : state;
    };
  }

  isInState(tag: S["_tag"]): boolean {
    return this.state._tag === tag;
  }

  getState<K extends S["_tag"]>(tag: K): Option<Extract<S, { _tag: K }>> {
    return this.state._tag === tag ? some(this.state as Extract<S, { _tag: K }>) : none();
  }

  select<K extends keyof S>(key: K): S[K] | undefined {
    return key in this.state ? this.state[key] : undefined;
  }
}
