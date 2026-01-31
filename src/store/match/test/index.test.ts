import { describe, it, expect } from "vitest";
import { createStore, matchState, exhaust, taggedEnum } from "../../index";

const CounterState = taggedEnum({
  Idle: { value: 0 },
  Loading: {},
  Ready: { value: 0 },
  Error: { message: "" },
});

describe("matchState()", () => {
  it("should return value for matching case", () => {
    const store = createStore(CounterState.Ready({ value: 10 }), CounterState, {
      name: "Counter",
    });

    const result = matchState(store.stateValue, {
      Idle: () => "idle",
      Loading: () => "loading",
      Ready: () => "ready",
      Error: () => "error",
    });

    expect(result).toBe("ready");
  });

  it("should return undefined for non-matching cases", () => {
    const store = createStore(CounterState.Ready({ value: 10 }), CounterState, {
      name: "Counter",
    });

    const result = matchState(store.stateValue, {
      Idle: () => "idle",
      Loading: () => "loading",
    });

    expect(result).toBeUndefined();
  });

  it("should work with complex return types", () => {
    const store = createStore(CounterState.Ready({ value: 42 }), CounterState, {
      name: "Counter",
    });

    const result = matchState(store.stateValue, {
      Idle: (s) => `Idle: ${s.value}`,
      Ready: (s) => `Ready: ${s.value}`,
      Error: (s) => `Error: ${s.message}`,
    });

    expect(result).toBe("Ready: 42");
  });
});

describe("exhaust()", () => {
  it("should return value for matching case", () => {
    const store = createStore(CounterState.Ready({ value: 10 }), CounterState, {
      name: "Counter",
    });

    const result = exhaust(store.stateValue, {
      Idle: (s) => `Idle: ${s.value}`,
      Loading: () => "Loading",
      Ready: (s) => `Ready: ${s.value}`,
      Error: (s) => `Error: ${s.message}`,
    });

    expect(result).toBe("Ready: 10");
  });

  it("should handle all state variants", () => {
    const idleStore = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "Counter",
    });
    const loadingStore = createStore(CounterState.Loading({}), CounterState, {
      name: "Counter",
    });
    const readyStore = createStore(CounterState.Ready({ value: 10 }), CounterState, {
      name: "Counter",
    });
    const errorStore = createStore(CounterState.Error({ message: "fail" }), CounterState, {
      name: "Counter",
    });

    const mapper = {
      Idle: (s: typeof idleStore.stateValue) => `Idle:${s.value}`,
      Loading: () => "Loading",
      Ready: (s: typeof readyStore.stateValue) => `Ready:${s.value}`,
      Error: (s: typeof errorStore.stateValue) => `Error:${s.message}`,
    };

    expect(exhaust(idleStore.stateValue, mapper)).toBe("Idle:0");
    expect(exhaust(loadingStore.stateValue, mapper)).toBe("Loading");
    expect(exhaust(readyStore.stateValue, mapper)).toBe("Ready:10");
    expect(exhaust(errorStore.stateValue, mapper)).toBe("Error:fail");
  });
});
