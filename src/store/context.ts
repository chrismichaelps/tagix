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
import { isFunction } from "../lib/Data/predicate";
import { none, some, type Option } from "../lib/Data/option";

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

export interface ContextConfig {
  parent: TagixContext<{ readonly _tag: string }> | null;
  autoCleanup?: boolean;
}

export class TagixContext<S extends { readonly _tag: string }> {
  private store: TagixStore<S>;
  private rootEntry: ContextEntry<S>;
  private subscriptions: Map<ContextId, ContextSubscription> = new Map();
  private childContexts: Set<TagixContext<{ readonly _tag: string }>> = new Set();
  private _id: ContextId;
  private disposed = false;
  private _providedValues?: Map<ContextId, ContextEntry<unknown>>;

  constructor(store: TagixStore<S>, config: ContextConfig = { parent: null, autoCleanup: true }) {
    this.store = store;
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

  private _notifyChange(newState: S): void {
    this.rootEntry.value = this.store.stateValue;

    for (const sub of this.subscriptions.values()) {
      try {
        sub.callback(this.store.stateValue);
      } catch {}
    }

    for (const child of this.childContexts) {
      child._propagateChange(this.store.stateValue);
    }
  }

  private _propagateChange(parentState: S): void {
    for (const sub of this.subscriptions.values()) {
      try {
        sub.callback(parentState);
      } catch {}
    }
  }

  get id(): ContextId {
    return this._id;
  }

  get storeName(): string {
    return this.store.name;
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  provide<T>(key: ContextId, value: T | ((parentValue: S) => T)): TagixContext<S> {
    if (this.disposed) {
      throw new Error("Cannot create sub-context on disposed context");
    }

    const parentValue = this.getCurrent();
    const resolvedValue = isFunction(value) ? value(parentValue) : value;

    const entry: ContextEntry<T> = {
      id: key,
      value: resolvedValue,
      parent: this.rootEntry,
      children: new Set(),
    };

    const mockStore = {
      stateValue: resolvedValue,
      name: `${this.storeName}.${String(key)}`,
      subscribe: () => () => {},
      dispatch: () => {},
      subscribeKey: () => () => {},
      getState: () => resolvedValue as unknown as S,
      registeredActions: [],
      lastError: undefined,
      errorHistory: [],
      configValue: {
        name: "",
        strict: false,
        maxErrorHistory: 50,
        maxRetries: 3,
        middlewares: [],
      },
      lastErrorCode: undefined,
      lastErrorCategory: undefined,
      isLastErrorRecoverable: false,
      getErrorInfo: () => null,
      getErrorCountByCategory: () => new Map(),
      getErrorsByCategory: () => [],
      clearErrorHistory: () => {},
      getTotalErrorCount: () => 0,
      hasErrorCode: () => false,
    } as unknown as TagixStore<S>;

    const subContext = new TagixContext(mockStore, { parent: null, autoCleanup: true });

    const subContextAny = subContext as unknown as {
      subscriptions: Map<ContextId, ContextSubscription>;
    };
    subContextAny.subscriptions.set(key, {
      entry: entry as ContextEntry<unknown>,
      callback: () => {},
      unsubscribe: () => {},
    });

    return subContext;
  }

  select<T>(selector: (state: S) => T, callback: (value: T) => void): () => void {
    if (this.disposed) {
      throw new Error("Cannot select on disposed context");
    }

    const wrappedCallback = (state: unknown): void => {
      const selected = selector(state as S);
      callback(selected);
    };

    wrappedCallback(this.store.stateValue);

    const unsubscribe = this.store.subscribe(wrappedCallback);

    const subscriptionId = Symbol("select");
    this.subscriptions.set(subscriptionId, {
      entry: this.rootEntry,
      callback: wrappedCallback,
      unsubscribe,
    });

    return () => {
      unsubscribe();
      this.subscriptions.delete(subscriptionId);
    };
  }

  selectAsync<T>(selector: (state: S) => T): {
    promise: Promise<T>;
    unsubscribe: () => void;
  } {
    if (this.disposed) {
      throw new Error("Cannot select on disposed context");
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

  getCurrent(): S {
    if (this.disposed) {
      throw new Error("Cannot get value from disposed context");
    }
    return this.store.stateValue;
  }

  get<T>(key: ContextId): Option<T> {
    if (this.disposed) {
      return none();
    }

    const subscription = this.subscriptions.get(key);
    if (subscription) {
      return some(subscription.entry.value as T);
    }

    if (this._providedValues) {
      const entry = this._providedValues.get(key);
      if (entry) {
        return some(entry.value as T);
      }
    }

    return none();
  }

  getState(): S {
    return this.getCurrent();
  }

  dispatch<TPayload>(type: string, payload: TPayload): void | Promise<void> {
    if (this.disposed) {
      throw new Error("Cannot dispatch on disposed context");
    }
    return this.store.dispatch(type, payload);
  }

  clone(): TagixContext<S> {
    if (this.disposed) {
      throw new Error("Cannot clone disposed context");
    }

    return new TagixContext(this.store, { parent: null });
  }

  fork(): TagixContext<S> {
    if (this.disposed) {
      throw new Error("Cannot fork disposed context");
    }

    const forkContext = new TagixContext(this.store, { parent: null });

    return forkContext;
  }

  merge(other: TagixContext<S>): void {
    if (this.disposed || other.disposed) {
      throw new Error("Cannot merge disposed contexts");
    }

    const otherState = other.getCurrent();
    Object.assign(this.rootEntry.value, otherState);
    this._notifyChange(this.getCurrent());
  }

  subscribe(callback: (state: S) => void): () => void {
    if (this.disposed) {
      throw new Error("Cannot subscribe on disposed context");
    }

    callback(this.getCurrent());
    return this.store.subscribe(callback);
  }

  subscribeKey<K extends keyof S>(key: K, callback: (value: S[K]) => void): () => void {
    return this.select((state) => state[key], callback);
  }

  use(): S;
  use<T>(selector: (state: S) => T): T;
  use<T>(selector?: (state: S) => T): T | S {
    if (this.disposed) {
      throw new Error("Context has been disposed");
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

  [Symbol.dispose](): void {
    this.dispose();
  }
}

export function createContext<S extends { readonly _tag: string }>(
  store: TagixStore<S>,
  config?: ContextConfig
): TagixContext<S> {
  return new TagixContext(store, config);
}
