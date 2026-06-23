import { describe, it, expect, vi } from "vitest";
import { createStore, persist, taggedEnum, type StorageLike } from "../../index";

const CounterState = taggedEnum({
  Idle: { value: 0 },
  Ready: { value: 0 },
});
type CounterStateType = typeof CounterState.State;

function memoryStorage(
  initial: Record<string, string> = {}
): StorageLike & { data: Record<string, string> } {
  const data: Record<string, string> = { ...initial };
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

const value = (s: CounterStateType) => (s as Extract<CounterStateType, { value: number }>).value;

describe("persist", () => {
  it("writes state to storage on change", () => {
    const storage = memoryStorage();
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState);
    persist(store, { key: "counter", storage });

    store.setState(CounterState.Ready({ value: 7 }));

    expect(JSON.parse(storage.data.counter)).toEqual({ _tag: "Ready", value: 7 });
  });

  it("hydrates the store from storage on call", () => {
    const storage = memoryStorage({ counter: JSON.stringify({ _tag: "Ready", value: 42 }) });
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

    persist(store, { key: "counter", storage });

    expect(store.stateValue._tag).toBe("Ready");
    expect(value(store.stateValue)).toBe(42);
  });

  it("stops writing after the cleanup function is called", () => {
    const storage = memoryStorage();
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState);
    const stop = persist(store, { key: "counter", storage });

    store.setState(CounterState.Ready({ value: 1 }));
    expect(value(JSON.parse(storage.data.counter))).toBe(1);

    stop();
    store.setState(CounterState.Ready({ value: 99 }));
    expect(value(JSON.parse(storage.data.counter))).toBe(1); // unchanged after stop
  });

  it("reports corrupt stored data via onError and leaves state intact", () => {
    const storage = memoryStorage({ counter: "{not valid json" });
    const store = createStore(CounterState.Idle({ value: 5 }), CounterState);
    const onError = vi.fn();

    persist(store, { key: "counter", storage, onError });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(store.stateValue._tag).toBe("Idle");
    expect(value(store.stateValue)).toBe(5);
  });

  it("supports custom serialize/deserialize", () => {
    const storage = memoryStorage();
    const store = createStore(CounterState.Ready({ value: 3 }), CounterState);

    persist(store, {
      key: "counter",
      storage,
      serialize: (s) => `v=${value(s)}`,
      deserialize: (raw) => CounterState.Ready({ value: Number(raw.replace("v=", "")) }),
    });

    expect(storage.data.counter).toBe("v=3");
  });

  it("reports storage write failures via onError without throwing", () => {
    const failing: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota exceeded");
      },
      removeItem: () => {},
    };
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState);
    const onError = vi.fn();

    // subscribe fires immediately → setItem throws → reported, not thrown.
    expect(() => persist(store, { key: "counter", storage: failing, onError })).not.toThrow();
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
