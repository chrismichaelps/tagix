import { describe, it, expect, vi } from "vitest";
import {
  createStore,
  createAction,
  createAsyncAction,
  createSlice,
  persist,
  fork,
  taggedEnum,
  type StorageLike,
} from "../index";
import { getValue } from "./utils";

/**
 * Realistic, multi-feature scenario tests that probe the integration seams unit
 * tests miss: async retry/merge, concurrency, subscriber re-entrancy, error
 * eviction, persistence round-trips, fork isolation, and full slice lifecycles.
 */

const Counter = taggedEnum({
  Idle: { value: 0 },
  Ready: { value: 0 },
  Error: { message: "" },
});
type CounterType = typeof Counter.State;

describe("scenario: async retry lifecycle", () => {
  const Api = taggedEnum({
    Idle: {},
    Loading: {},
    Success: { data: "" },
    Failed: { message: "" },
  });
  type ApiType = typeof Api.State;

  function flaky(failTimes: number) {
    let runs = 0;
    const action = createAsyncAction<void, ApiType, string>("Fetch")
      .state(() => Api.Loading({}))
      .effect(async () => {
        runs++;
        if (runs <= failTimes) throw new Error(`fail-${runs}`);
        return "ok";
      })
      .onSuccess((_s, data) => Api.Success({ data }))
      .onError((_s, e) => Api.Failed({ message: e instanceof Error ? e.message : "?" }));
    return { action, runs: () => runs };
  }

  it("succeeds on a retry and records no error", async () => {
    const store = createStore(Api.Idle({}), Api, { maxRetries: 3 });
    const { action, runs } = flaky(2); // fail twice, succeed on the 3rd run
    store.register("Fetch", action);

    await store.dispatch("tagix/action/Fetch", undefined);

    expect(runs()).toBe(3);
    expect(store.stateValue._tag).toBe("Success");
    expect((store.stateValue as Extract<ApiType, { data: string }>).data).toBe("ok");
    expect(store.getTotalErrorCount()).toBe(0); // intermediate retries are not recorded
  });

  it("exhausts retries and records exactly one final error", async () => {
    const store = createStore(Api.Idle({}), Api, { maxRetries: 2 });
    const { action, runs } = flaky(99); // always fails
    store.register("Fetch", action);

    await store.dispatch("tagix/action/Fetch", undefined);

    expect(runs()).toBe(3); // 1 initial + 2 retries
    expect(store.stateValue._tag).toBe("Failed");
    expect(store.getTotalErrorCount()).toBe(1);
    expect(store.lastError).toBeInstanceOf(Error);
  });

  it("runs the effect exactly once when retries are not configured", async () => {
    const store = createStore(Api.Idle({}), Api); // maxRetries defaults to 0
    const { action, runs } = flaky(99);
    store.register("Fetch", action);

    await store.dispatch("tagix/action/Fetch", undefined);

    expect(runs()).toBe(1);
    expect(store.stateValue._tag).toBe("Failed");
  });
});

describe("scenario: concurrent async + sync merge onto fresh state", () => {
  const App = taggedEnum({ Active: { count: 0, data: "" } });
  type AppType = typeof App.State;

  it("onSuccess merges onto state mutated while the effect was in flight", async () => {
    const store = createStore(App.Active({ count: 0, data: "" }), App);

    const fetch = createAsyncAction<void, AppType, string>("Fetch")
      .state((s) => App.Active({ ...s }))
      .effect(async () => {
        await new Promise((r) => setTimeout(r, 5));
        return "X";
      })
      .onSuccess((fresh, data) => App.Active({ ...(fresh as AppType & { count: number }), data }))
      .onError((s) => s);

    const inc = createAction<void, AppType>("Inc").withState((s) =>
      App.Active({ ...(s as AppType & { count: number }), count: (s as { count: number }).count + 1 })
    );
    store.register("Fetch", fetch);
    store.register("Inc", inc);

    const pending = store.dispatch(fetch, undefined); // async, in flight
    store.dispatch(inc, undefined); // sync, runs while effect awaits
    await pending;

    const final = store.stateValue as AppType & { count: number; data: string };
    expect(final.count).toBe(1); // sync change preserved
    expect(final.data).toBe("X"); // async result merged onto the fresh (post-inc) state
  });
});

describe("scenario: subscriber resilience and re-entrancy", () => {
  it("isolates a throwing subscriber and still notifies the rest", () => {
    const store = createStore(Counter.Idle({ value: 0 }), Counter);
    const seen: number[] = [];
    store.subscribe(() => {
      throw new Error("subscriber boom");
    });
    store.subscribe((s) => seen.push(getValue(s)));

    const inc = createAction<void, CounterType>("Inc").withState((s) =>
      Counter.Ready({ value: getValue(s) + 1 })
    );
    store.register("Inc", inc);
    store.dispatch(inc, undefined);

    expect(seen).toEqual([0, 1]); // second subscriber unaffected
    expect(store.getTotalErrorCount()).toBeGreaterThanOrEqual(1); // throw recorded
  });

  it("settles a controlled re-entrant subscriber without overflowing", () => {
    const store = createStore(Counter.Idle({ value: 0 }), Counter);
    const inc = createAction<void, CounterType>("Inc").withState((s) =>
      Counter.Ready({ value: getValue(s) + 1 })
    );
    store.register("Inc", inc);

    // `subscribe` invokes the callback immediately before registering it, so its
    // first run dispatches against an empty subscriber set. Trigger re-entrancy
    // with an explicit dispatch once the subscriber is registered.
    store.subscribe((s) => {
      if (getValue(s) < 3) store.dispatch(inc, undefined);
    });
    store.dispatch(inc, undefined);

    expect(getValue(store.stateValue)).toBe(3); // climbs to 3 then stops
  });

  it("breaks an unconditional re-entrant cycle and records a warning", () => {
    const store = createStore(Counter.Idle({ value: 0 }), Counter);
    const inc = createAction<void, CounterType>("Inc").withState((s) =>
      Counter.Ready({ value: getValue(s) + 1 })
    );
    store.register("Inc", inc);

    store.subscribe(() => {
      store.dispatch(inc, undefined); // dispatches on every notification
    });

    // Once registered, a real dispatch starts the cycle — it must be bounded.
    expect(() => store.dispatch(inc, undefined)).not.toThrow();

    const errors = store.errorHistory.map(String);
    expect(errors.some((m) => /cycle/i.test(m))).toBe(true);
  });
});

describe("scenario: error history eviction", () => {
  it("caps history at maxErrorHistory, keeping the most recent", () => {
    const store = createStore(Counter.Idle({ value: 0 }), Counter, { maxErrorHistory: 3 });
    const boom = createAction<number, CounterType>("Boom").withState((_s, n) => {
      throw new Error(`e${n}`);
    });
    store.register("Boom", boom);

    for (let n = 1; n <= 5; n++) store.dispatch(boom, n);

    expect(store.getTotalErrorCount()).toBe(3);
    const messages = store.errorHistory.map((e) => (e as Error).message);
    expect(messages).toEqual(["e3", "e4", "e5"]); // oldest two evicted
    expect((store.lastError as Error).message).toBe("e5");
  });
});

describe("scenario: persistence round-trip across instances", () => {
  function memoryStorage(seed: Record<string, string> = {}): StorageLike & {
    data: Record<string, string>;
  } {
    const data = { ...seed };
    return {
      data,
      getItem: (k) => (k in data ? data[k] : null),
      setItem: (k, v) => {
        data[k] = v;
      },
      removeItem: (k) => {
        delete data[k];
      },
    };
  }

  it("hydrates a fresh store from a previous store's persisted state", () => {
    const storage = memoryStorage();

    const store1 = createStore(Counter.Idle({ value: 0 }), Counter);
    persist(store1, { key: "c", storage });
    const set = createAction<number, CounterType>("Set").withState((_s, v) =>
      Counter.Ready({ value: v })
    );
    store1.register("Set", set);
    store1.dispatch(set, 17);

    const store2 = createStore(Counter.Idle({ value: 0 }), Counter);
    persist(store2, { key: "c", storage });

    expect(store2.stateValue._tag).toBe("Ready");
    expect(getValue(store2.stateValue)).toBe(17);
  });
});

describe("scenario: fork isolation", () => {
  it("a fork evolves independently of its source", () => {
    const source = createStore(Counter.Ready({ value: 10 }), Counter);
    const inc = createAction<void, CounterType>("Inc").withState((s) =>
      Counter.Ready({ value: getValue(s) + 1 })
    );
    source.register("Inc", inc);

    const child = fork(source);
    child.register("Inc", inc);
    child.dispatch(inc, undefined);

    expect(getValue(child.stateValue)).toBe(11);
    expect(getValue(source.stateValue)).toBe(10); // source untouched
  });
});

describe("scenario: full slice app with services, selector subscription, reset", () => {
  const Cart = taggedEnum({
    Empty: {},
    Active: { items: [] as string[], total: 0 },
  });
  type CartType = typeof Cart.State;

  it("drives a colocated slice end to end", async () => {
    const priceOf = (item: string) => (item === "apple" ? 3 : 5);

    const cart = createSlice({
      state: Cart.Empty({}),
      schema: Cart,
      actions: {
        add: (s, item: string) => {
          const items = s._tag === "Active" ? [...s.items, item] : [item];
          return Cart.Active({ items, total: items.length });
        },
        clear: () => Cart.Empty({}),
        checkout: createAsyncAction<void, CartType, void>("Checkout")
          .state((s) => ({ ...s }))
          .effect(async () => {
            await new Promise((r) => setTimeout(r, 1)); // simulate async work
          })
          .onSuccess((s) =>
            s._tag === "Active"
              ? Cart.Active({
                  items: s.items,
                  total: s.items.reduce((sum, i) => sum + priceOf(i), 0),
                })
              : s
          )
          .onError((s) => s),
      },
    });

    // selector subscription tracks item count, deduped
    const counts: number[] = [];
    cart.store.subscribe(
      (s) => (s._tag === "Active" ? s.items.length : 0),
      (n) => counts.push(n)
    );

    cart.actions.add("apple");
    cart.actions.add("pear");
    expect(cart.store.stateValue._tag).toBe("Active");

    await cart.actions.checkout();
    const active = cart.store.stateValue as Extract<CartType, { total: number }>;
    expect(active.total).toBe(8); // 3 + 5

    cart.actions.clear();
    expect(cart.store.stateValue._tag).toBe("Empty");

    cart.store.reset();
    expect(cart.store.stateValue._tag).toBe("Empty");

    // selector saw: 0 (initial), 1 (apple), 2 (pear), 0 (clear); checkout kept length 2 → deduped.
    expect(counts).toEqual([0, 1, 2, 0]);
  });
});
