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

import type { TagixStore } from "./core";
import { createStore } from "./core";
import { isFunction, isRecord } from "../lib/Data/predicate";
import { none, some, type Option } from "../lib/Data/option";
import { deepEqual } from "./selectors";
import { ContextDisposedError } from "./error";

/**
 * Unique identifier for context entries and subcontexts.
 */
export type ContextId = symbol | string;

interface ContextEntry<T> {
  id: ContextId;
  value: T;
  parent: ContextEntry<unknown> | null;
  children: Set<ContextEntry<unknown>>;
}

interface ContextSubscription {
  entry: ContextEntry<unknown>;
  callback: (value: unknown) => void;
  unsubscribe: () => void;
}

/**
 * Configuration options for creating a TagixContext.
 */
export interface ContextConfig {
  /** Parent context for hierarchical context trees. */
  parent: TagixContext<{ readonly _tag: string }> | null;
  /** Automatically cleanup subscriptions when context is disposed. @default true */
  autoCleanup?: boolean;
  /** Error handler invoked when subscription callbacks throw. */
  onError?: (error: unknown) => void;
}

interface MinimalStore<T> {
  readonly stateValue: T;
  readonly name: string;
  subscribe: (callback: (state: T) => void) => () => void;
  dispatch: (typeOrAction: string | object, payload?: unknown) => void | Promise<void>;
}

/**
 * Context wrapper around TagixStore providing dependency injection, subcontexts, and hook patterns.
 * @typeParam S - The state type, must be a discriminated union with `_tag` property.
 * @remarks Manages subscriptions, child contexts, and provides dependency injection via `provide` method.
 */
export class TagixContext<S extends { readonly _tag: string }> {
  private store: MinimalStore<S>;
  private rootEntry: ContextEntry<S>;
  private subscriptions: Map<ContextId, ContextSubscription> = new Map();
  private childContexts: Set<TagixContext<{ readonly _tag: string }>> = new Set();
  private derivedContexts: Set<DerivedContext<S, unknown>> = new Set();
  private _id: ContextId;
  private disposed = false;
  private errorHandler?: (error: unknown) => void;

  /**
   * Creates a new TagixContext instance.
   * @param store - The TagixStore instance to wrap.
   * @param config - Optional context configuration.
   * @remarks Automatically subscribes to store state changes. If parent is provided, registers as child context.
   */
  constructor(store: TagixStore<S>, config: ContextConfig = { parent: null, autoCleanup: true }) {
    this.store = store;
    this.errorHandler = config.onError;
    this._id = Symbol(`TagixContext-${store.name}`);
    this.rootEntry = {
      id: this._id,
      value: store.stateValue,
      parent: null,
      children: new Set(),
    };

    if (config.parent) {
      config.parent._addChild(this as unknown as TagixContext<{ readonly _tag: string }>);
    }

    store.subscribe((state) => {
      this._notifyChange(state);
    });
  }

  private _addChild(child: TagixContext<{ readonly _tag: string }>): void {
    this.childContexts.add(child);
  }

  private _handleError(error: unknown): void {
    if (this.errorHandler) {
      this.errorHandler(error);
    }
  }

  private _notifyChange(newState: S): void {
    this.rootEntry.value = newState;

    for (const sub of this.subscriptions.values()) {
      try {
        sub.callback(newState);
      } catch (error) {
        this._handleError(error);
      }
    }

    for (const child of this.childContexts) {
      child._propagateChange(newState);
    }
  }

  private _propagateChange(parentState: S): void {
    this.rootEntry.value = parentState;

    for (const sub of this.subscriptions.values()) {
      try {
        sub.callback(parentState);
      } catch (error) {
        this._handleError(error);
      }
    }
  }

  /**
   * Unique identifier for this context instance.
   */
  get id(): ContextId {
    return this._id;
  }

  /**
   * Name of the underlying store.
   */
  get storeName(): string {
    return this.store.name;
  }

  /**
   * Whether this context has been disposed.
   * @remarks Disposed contexts throw errors on most operations.
   */
  get isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Creates a subcontext with a provided value or derived value.
   * @typeParam T - The value type to provide.
   * @param key - Unique identifier for the provided value.
   * @param value - Static value or function that derives value from parent state.
   * @returns A new subcontext with the provided value.
   * @throws {Error} If context is disposed.
   * @remarks Supports dependency injection pattern. Derived values are computed from parent state.
   */
  provide<T>(key: ContextId, value: T | ((parentValue: S) => T)): TagixContext<S> {
    if (this.disposed) {
      throw new ContextDisposedError({
        action: "createSubcontext",
        message: "Cannot create subcontext on disposed context",
      });
    }

    const parentValue = this.getCurrent();
    const resolvedValue = isFunction(value) ? value(parentValue) : value;

    const entry: ContextEntry<T> = {
      id: key,
      value: resolvedValue,
      parent: this.rootEntry,
      children: new Set(),
    };

    const subContext = new DerivedContext(resolvedValue as unknown as S, key, entry, this);

    this.derivedContexts.add(subContext);

    return subContext as unknown as TagixContext<S>;
  }

  /**
   * Selects a value from state and subscribes to changes.
   * @typeParam T - The selected value type.
   * @param selector - Function that extracts value from state.
   * @param callback - Function called with selected value on state changes.
   * @returns Unsubscribe function.
   * @throws {Error} If context is disposed.
   * @remarks Callback is invoked immediately with current value, then on each state change where selected value differs.
   */
  select<T>(selector: (state: S) => T, callback: (value: T) => void): () => void {
    if (this.disposed) {
      throw new ContextDisposedError({
        action: "select",
        message: "Cannot select on disposed context",
      });
    }

    let lastSelected: T | undefined;

    const wrappedCallback = (state: unknown): void => {
      const selected = selector(state as S);
      if (lastSelected !== undefined && deepEqual(selected, lastSelected)) {
        return;
      }
      lastSelected = selected;
      callback(selected);
    };

    wrappedCallback(this.getCurrent());

    const subscriptionId = Symbol("select");
    this.subscriptions.set(subscriptionId, {
      entry: this.rootEntry,
      callback: wrappedCallback,
      unsubscribe: () => {},
    });

    return () => {
      this.subscriptions.delete(subscriptionId);
    };
  }

  /**
   * Selects a value from state and returns a promise that resolves with the selected value.
   * @typeParam T - The selected value type.
   * @param selector - Function that extracts value from state.
   * @returns Object with promise and unsubscribe function.
   * @throws {Error} If context is disposed.
   * @remarks Promise resolves immediately with current selected value. Unsubscribe to cancel subscription.
   */
  selectAsync<T>(selector: (state: S) => T): {
    promise: Promise<T>;
    unsubscribe: () => void;
  } {
    if (this.disposed) {
      throw new ContextDisposedError({
        action: "select",
        message: "Cannot select on disposed context",
      });
    }

    let resolve: (value: T) => void;

    const promise = new Promise<T>((res) => {
      resolve = res;
    });

    const unsubscribe = this.select(selector, (value) => {
      resolve(value);
    });

    return { promise, unsubscribe };
  }

  /**
   * Gets the current state value.
   * @returns The current state.
   * @throws {Error} If context is disposed.
   */
  getCurrent(): S {
    if (this.disposed) {
      throw new ContextDisposedError({
        action: "getValue",
        message: "Cannot get value from disposed context",
      });
    }
    return this.store.stateValue;
  }

  /**
   * Gets a value from the context by key.
   * @typeParam T - The value type.
   * @param key - The context key to look up.
   * @returns Some(value) if found, None otherwise.
   * @remarks Returns None if context is disposed or key doesn't exist.
   */
  get<T>(key: ContextId): Option<T> {
    if (this.disposed) {
      return none();
    }

    const subscription = this.subscriptions.get(key);
    if (subscription) {
      return some(subscription.entry.value as T);
    }

    return none();
  }

  /**
   * Gets the current state (alias for getCurrent).
   * @returns The current state.
   */
  getState(): S {
    return this.getCurrent();
  }

  /**
   * Dispatches an action to the underlying store.
   * Supports string-based dispatch and action-object dispatch.
   * @typeParam TPayload - The payload type.
   * @param typeOrAction - The action type string or action object.
   * @param payload - The action payload.
   * @returns Promise for async actions, void for sync actions.
   * @throws {Error} If context is disposed.
   */
  dispatch<TPayload>(typeOrAction: string | object, payload?: TPayload): void | Promise<void> {
    if (this.disposed) {
      throw new ContextDisposedError({
        action: "dispatch",
        message: "Cannot dispatch on disposed context",
      });
    }
    return this.store.dispatch(typeOrAction as string, payload);
  }

  /**
   * Creates a new context instance sharing the same store.
   * @returns A new context instance.
   * @throws {Error} If context is disposed.
   * @remarks Clone has independent subscriptions but shares the same store state.
   */
  clone(): TagixContext<S> {
    if (this.disposed) {
      throw new ContextDisposedError({ action: "clone", message: "Cannot clone disposed context" });
    }

    return new TagixContext(this.store as TagixStore<S>, { parent: null });
  }

  /**
   * Creates a forked context with isolated state.
   * @returns A new context with its own store instance.
   * @throws {Error} If context is disposed.
   * @remarks Fork creates a completely independent copy of state. Changes to the fork do not affect the parent, and vice versa.
   */
  fork(): TagixContext<S> {
    if (this.disposed) {
      throw new ContextDisposedError({ action: "fork", message: "Cannot fork disposed context" });
    }

    const tagixStore = this.store as TagixStore<S>;
    const currentState = tagixStore.stateValue;
    const stateConstructor = tagixStore.getStateConstructor();
    const config = tagixStore.configValue;

    const forkStore = createStore(currentState, stateConstructor, {
      name: `${tagixStore.name}-fork`,
      strict: config.strict,
      maxErrorHistory: config.maxErrorHistory,
      maxRetries: config.maxRetries,
      middlewares: config.middlewares,
    });

    const actions = tagixStore.getActions();
    for (const [type, action] of actions) {
      forkStore.register(type.replace("tagix/action/", ""), action);
    }

    const forkContext = new TagixContext(forkStore, { parent: null });

    return forkContext;
  }

  /**
   * Merges state from another context into this context.
   * @param other - The context to merge from.
   * @throws {Error} If either context is disposed.
   * @remarks Updates this context's store state with the other context's state.
   */
  merge(other: TagixContext<S>): void {
    if (this.disposed || other.disposed) {
      throw new ContextDisposedError({
        action: "merge",
        message: "Cannot merge disposed contexts",
      });
    }

    const otherState = other.getCurrent();
    const tagixStore = this.store as TagixStore<S>;
    tagixStore.setState(otherState);
  }

  /**
   * Subscribes to state changes.
   * @param callback - Function called whenever state changes.
   * @returns Unsubscribe function.
   * @throws {Error} If context is disposed.
   * @remarks Callback is invoked immediately with current state, then on each state change.
   */
  subscribe(callback: (state: S) => void): () => void {
    if (this.disposed) {
      throw new ContextDisposedError({
        action: "subscribe",
        message: "Cannot subscribe on disposed context",
      });
    }

    return this.store.subscribe(callback);
  }

  /**
   * Subscribes to changes of a specific state property.
   * @typeParam K - The property key type.
   * @param key - The property key to subscribe to.
   * @param callback - Function called when the property value changes.
   * @returns Unsubscribe function.
   * @remarks Convenience method that uses `select` internally.
   */
  subscribeKey<K extends keyof S>(key: K, callback: (value: S[K]) => void): () => void {
    return this.select((state) => state[key], callback);
  }

  /**
   * Access state or selected value using a hook pattern.
   * @returns Current state if no selector provided.
   * @throws {Error} If context is disposed.
   * @remarks Without selector, returns full state. With selector, returns selected value.
   */
  use(): S;
  /**
   * Access selected value from state using a hook pattern.
   * @typeParam T - The selected value type.
   * @param selector - Function that extracts value from state.
   * @returns The selected value.
   * @throws {Error} If context is disposed.
   */
  use<T>(selector: (state: S) => T): T;
  use<T>(selector?: (state: S) => T): T | S {
    if (this.disposed) {
      throw new ContextDisposedError({ action: "access", message: "Context has been disposed" });
    }

    if (selector) {
      let selected: T | undefined;
      const unsubscribe = this.select(selector, (value) => {
        selected = value;
      });
      unsubscribe();
      return selected as T;
    }

    return this.getCurrent();
  }

  /**
   * Disposes the context, cleaning up all subscriptions and child contexts.
   * @remarks Idempotent - safe to call multiple times. Disposes all child contexts recursively.
   */
  dispose(): void {
    if (this.disposed) return;

    for (const sub of this.subscriptions.values()) {
      sub.unsubscribe();
    }
    this.subscriptions.clear();

    for (const child of this.childContexts) {
      child.dispose();
    }
    this.childContexts.clear();

    for (const derived of this.derivedContexts) {
      derived.dispose();
    }
    this.derivedContexts.clear();

    this.disposed = true;
  }

  /**
   * Symbol.dispose implementation for using statement support.
   * @remarks Enables `using` statement syntax for automatic disposal.
   */
  [Symbol.dispose](): void {
    this.dispose();
  }
}

class DerivedContext<S extends { readonly _tag: string }, T> {
  private value: S;
  private entry: ContextEntry<T>;
  private parentContext: TagixContext<S>;
  private subscriptions: Map<ContextId, ContextSubscription> = new Map();
  private childContexts: Set<TagixContext<{ readonly _tag: string }>> = new Set();
  private disposed = false;

  constructor(
    value: S,
    private key: ContextId,
    entry: ContextEntry<T>,
    parentContext: TagixContext<S>
  ) {
    this.value = value;
    this.entry = entry;
    this.parentContext = parentContext;
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  get storeName(): string {
    return `${this.parentContext.storeName}.${String(this.key)}`;
  }

  provide<U>(key: ContextId, val: U | ((parentValue: S) => U)): TagixContext<S> {
    if (this.disposed) {
      throw new ContextDisposedError({
        action: "createSubcontext",
        message: "Cannot create subcontext on disposed context",
      });
    }

    const resolvedValue = isFunction(val) ? val(this.value) : val;

    const childEntry: ContextEntry<U> = {
      id: key,
      value: resolvedValue,
      parent: this.entry,
      children: new Set(),
    };

    const subContext = new DerivedContext(
      resolvedValue as unknown as S,
      key,
      childEntry,
      this.parentContext
    );

    this.childContexts.add(subContext as unknown as TagixContext<{ readonly _tag: string }>);

    return subContext as unknown as TagixContext<S>;
  }

  select<U>(selector: (state: S) => U, callback: (value: U) => void): () => void {
    if (this.disposed) {
      throw new ContextDisposedError({
        action: "select",
        message: "Cannot select on disposed context",
      });
    }

    const wrappedCallback = (state: unknown): void => {
      const selected = selector(state as S);
      callback(selected);
    };

    wrappedCallback(this.value);

    const subscriptionId = Symbol("derived-select");
    const unsubscribeFromParent = this.parentContext.subscribe(wrappedCallback);

    this.subscriptions.set(subscriptionId, {
      entry: this.entry,
      callback: wrappedCallback,
      unsubscribe: unsubscribeFromParent,
    });

    return () => {
      const sub = this.subscriptions.get(subscriptionId);
      if (sub) {
        sub.unsubscribe();
        this.subscriptions.delete(subscriptionId);
      }
    };
  }

  getCurrent(): S {
    if (this.disposed) {
      throw new ContextDisposedError({
        action: "getValue",
        message: "Cannot get value from disposed context",
      });
    }
    return this.value;
  }

  get<U>(key: ContextId): Option<U> {
    if (this.disposed) {
      return none();
    }

    if (key === this.key) {
      return some(this.entry.value as unknown as U);
    }

    return none();
  }

  getState(): S {
    return this.getCurrent();
  }

  fork(): TagixContext<S> {
    if (this.disposed) {
      throw new ContextDisposedError({ action: "fork", message: "Cannot fork disposed context" });
    }

    return this.parentContext.fork();
  }

  dispose(): void {
    if (this.disposed) return;

    for (const sub of this.subscriptions.values()) {
      sub.unsubscribe();
    }
    this.subscriptions.clear();

    for (const child of this.childContexts) {
      child.dispose();
    }
    this.childContexts.clear();

    this.disposed = true;
  }
}

/**
 * Creates a new TagixContext instance.
 * @typeParam S - The state type, must be a discriminated union with `_tag` property.
 * @param store - The TagixStore instance to wrap.
 * @param config - Optional context configuration.
 * @returns A new TagixContext instance.
 */
export function createContext<S extends { readonly _tag: string }>(
  store: TagixStore<S>,
  config?: ContextConfig
): TagixContext<S> {
  return new TagixContext(store, config);
}
