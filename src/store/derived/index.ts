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

import { TagixStore } from "../core/store";
import { deepEqual } from "../selectors";

/** Base constraint for all Tagix state types. */
type TaggedState = { readonly _tag: string };

/** A source store with any tagged state. Used internally to avoid `any`. */
type AnyTaggedStore = TagixStore<TaggedState>;

/** Deriver function that maps an array of states to a derived value. */
type DeriverFn<R> = (states: readonly TaggedState[]) => R;

/**
 * Configuration options for a derived store.
 */
export interface DerivedStoreConfig<R> {
  /**
   * Custom equality function to compare previous and next derived values.
   * When provided, subscribers are only notified when this returns `false`.
   * @default deepEqual
   */
  readonly equals?: (prev: R, next: R) => boolean;
}

/**
 * A read-only reactive store whose state is derived from one or more source
 * {@link TagixStore} instances. The derived value is recomputed whenever any
 * source store's state changes, and subscribers are only notified when the
 * derived value structurally changes (controlled via `deepEqual` or a custom
 * equality function).
 *
 * @typeParam R - The derived state type.
 *
 * @remarks
 * `DerivedStore` is intentionally **not** a `TagixStore`. It is read-only —
 * there is no `dispatch`, `register`, or `setState`. This prevents misuse and
 * keeps the data flow unidirectional: source stores own the state, and derived
 * stores passively compute and propagate.
 *
 * @example
 * ```ts
 * const cartTotal = deriveStore(
 *   [cartStore, discountStore],
 *   ([cart, discount]) => ({
 *     total: cart.items.reduce((sum, i) => sum + i.price, 0) * (1 - discount.rate),
 *   })
 * );
 *
 * cartTotal.subscribe((derived) => console.log(derived.total));
 * ```
 */
export class DerivedStore<R> {
  private _value: R;
  private readonly _subscribers: Set<(value: R) => void> = new Set();
  private readonly _unsubscribers: (() => void)[] = [];
  private _destroyed = false;
  private _equals: (prev: R, next: R) => boolean;
  private readonly _sources: readonly AnyTaggedStore[];
  private readonly _deriver: DeriverFn<R>;
  private _lastError: Error | null = null;

  /** @internal Use `deriveStore()` factory instead. */
  constructor(
    sources: readonly AnyTaggedStore[],
    deriver: DeriverFn<R>,
    config: DerivedStoreConfig<R> = {}
  ) {
    this._equals = config.equals ?? deepEqual;
    this._sources = sources;
    this._deriver = deriver;

    // Compute the initial derived value from the current source states.
    this._value = this._compute();

    // Subscribe to each source store. On any source change, recompute
    // the derived value and notify subscribers only if it changed.
    for (const source of sources) {
      // `TagixStore.subscribe` calls the callback immediately with current
      // state, so we skip that initial call — we already computed above.
      let initialized = false;
      const unsub = source.subscribe(() => {
        if (!initialized) {
          initialized = true;
          return;
        }
        // Wrap recompute in try-catch to catch derivation errors
        // Errors are stored and thrown when stateValue is accessed
        try {
          this._recompute();
        } catch (error) {
          this._lastError = error instanceof Error ? error : new Error(String(error));
        }
      });
      this._unsubscribers.push(unsub);
    }
  }

  /**
   * Gathers current source states and runs the deriver function.
   * @internal
   */
  private _compute(): R {
    const states = this._sources.map((s) => s.stateValue);
    return this._deriver(states);
  }

  /**
   * Current derived state value.
   * @throws Error if the last derivation failed.
   * @remarks Always reflects the latest computation from source stores.
   * If a derivation error occurred, accessing this property throws the error.
   * The error is consumed after being thrown (cleared) to allow recovery.
   */
  get stateValue(): R {
    if (this._lastError !== null) {
      const error = this._lastError;
      this._lastError = null; // Consume the error
      throw error;
    }
    return this._value;
  }

  /**
   * Whether this derived store has been destroyed.
   * @remarks Once destroyed, the store no longer reacts to source changes.
   */
  get destroyed(): boolean {
    return this._destroyed;
  }

  /**
   * Subscribes to derived state changes.
   *
   * The callback is called immediately with the current derived value,
   * matching the {@link TagixStore.subscribe} contract. Subsequent calls
   * occur only when the derived value structurally changes.
   *
   * @param callback - Function called with the derived state.
   * @returns An unsubscribe function.
   */
  subscribe(callback: (value: R) => void): () => void {
    callback(this._value);
    this._subscribers.add(callback);
    return () => {
      this._subscribers.delete(callback);
    };
  }

  /**
   * Destroys the derived store, unsubscribing from all source stores
   * and clearing all subscribers.
   *
   * @remarks After calling `destroy()`, the store will no longer react
   * to source store changes and all subscriber references are released.
   * The last computed `stateValue` remains accessible for final reads.
   */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    for (const unsub of this._unsubscribers) {
      unsub();
    }
    this._unsubscribers.length = 0;
    this._subscribers.clear();
  }

  /**
   * Recomputes the derived value and notifies subscribers if it changed.
   * @internal
   */
  private _recompute(): void {
    if (this._destroyed) return;

    try {
      const next = this._compute();
      this._lastError = null;
      if (!this._equals(this._value, next)) {
        this._value = next;
        this._notifySubscribers();
      }
    } catch (error) {
      this._lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  private _notifySubscribers(): void {
    const current = this._value;
    for (const subscriber of this._subscribers) {
      subscriber(current);
    }
  }
}

/**
 * Creates a reactive derived store from two source stores.
 * @param sources - Tuple of two `TagixStore` instances.
 * @param deriver - Pure function that computes derived state from source states.
 * @param config  - Optional configuration (custom equality function).
 * @returns A new `DerivedStore` instance.
 */
export function deriveStore<S1 extends TaggedState, S2 extends TaggedState, R>(
  sources: [TagixStore<S1>, TagixStore<S2>],
  deriver: (states: [S1, S2]) => R,
  config?: DerivedStoreConfig<R>
): DerivedStore<R>;

/**
 * Creates a reactive derived store from three source stores.
 * @param sources - Tuple of three `TagixStore` instances.
 * @param deriver - Pure function that computes derived state from source states.
 * @param config  - Optional configuration (custom equality function).
 * @returns A new `DerivedStore` instance.
 */
export function deriveStore<
  S1 extends TaggedState,
  S2 extends TaggedState,
  S3 extends TaggedState,
  R,
>(
  sources: [TagixStore<S1>, TagixStore<S2>, TagixStore<S3>],
  deriver: (states: [S1, S2, S3]) => R,
  config?: DerivedStoreConfig<R>
): DerivedStore<R>;

/**
 * Creates a reactive derived store from four source stores.
 * @param sources - Tuple of four `TagixStore` instances.
 * @param deriver - Pure function that computes derived state from source states.
 * @param config  - Optional configuration (custom equality function).
 * @returns A new `DerivedStore` instance.
 */
export function deriveStore<
  S1 extends TaggedState,
  S2 extends TaggedState,
  S3 extends TaggedState,
  S4 extends TaggedState,
  R,
>(
  sources: [TagixStore<S1>, TagixStore<S2>, TagixStore<S3>, TagixStore<S4>],
  deriver: (states: [S1, S2, S3, S4]) => R,
  config?: DerivedStoreConfig<R>
): DerivedStore<R>;

/**
 * Creates a reactive derived store from five source stores.
 * @param sources - Tuple of five `TagixStore` instances.
 * @param deriver - Pure function that computes derived state from source states.
 * @param config  - Optional configuration (custom equality function).
 * @returns A new `DerivedStore` instance.
 */
export function deriveStore<
  S1 extends TaggedState,
  S2 extends TaggedState,
  S3 extends TaggedState,
  S4 extends TaggedState,
  S5 extends TaggedState,
  R,
>(
  sources: [TagixStore<S1>, TagixStore<S2>, TagixStore<S3>, TagixStore<S4>, TagixStore<S5>],
  deriver: (states: [S1, S2, S3, S4, S5]) => R,
  config?: DerivedStoreConfig<R>
): DerivedStore<R>;

/**
 * Creates a reactive, read-only store whose state is derived from one or more
 * source `TagixStore` instances.
 *
 * The derived value is recomputed whenever any source store changes.
 * Subscribers are only notified if the derived value structurally changed
 * (controlled by `deepEqual` or a custom equality function via `config.equals`).
 *
 * @param sources - Array of source `TagixStore` instances (2–5).
 * @param deriver - Pure function that computes the derived value from source states.
 * @param config  - Optional configuration.
 * @returns A new `DerivedStore` instance.
 *
 * @example
 * ```ts
 * const summary = deriveStore(
 *   [cartStore, userStore],
 *   ([cart, user]) => ({
 *     itemCount: cart.items.length,
 *     greeting: `Hello, ${user.name}`,
 *   })
 * );
 *
 * summary.subscribe((s) => console.log(s.greeting));
 *
 * // Cleanup when done
 * summary.destroy();
 * ```
 */
export function deriveStore(
  sources: readonly AnyTaggedStore[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Implementation signature must be maximally permissive for overload compatibility.
  deriver: (...args: never[]) => unknown,
  config?: DerivedStoreConfig<unknown>
): DerivedStore<unknown> {
  return new DerivedStore(sources, deriver as DeriverFn<unknown>, config);
}
