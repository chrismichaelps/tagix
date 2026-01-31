import { describe, it, expect } from "vitest";
import { createStore, when, on, withState, getTag, isInState, taggedEnum } from "../../index";

const CounterState = taggedEnum({
  Idle: { value: 0 },
  Loading: {},
  Ready: { value: 0 },
  Error: { message: "" },
});

describe("when()", () => {
  it("should return true for matching state tag", () => {
    const store = createStore(CounterState.Ready({ value: 10 }), CounterState, {
      name: "Counter",
    });
    const state = store.stateValue;

    expect(when("Ready")(state)).toBe(true);
    expect(when("Idle")(state)).toBe(false);
    expect(when("Loading")(state)).toBe(false);
    expect(when("Error")(state)).toBe(false);
  });

  it("should narrow state type when guard passes", () => {
    const store = createStore(CounterState.Ready({ value: 42 }), CounterState, {
      name: "Counter",
    });
    const state = store.stateValue;

    if (when("Ready")(state)) {
      expect(state.value).toBe(42);
    }
  });
});

describe("on()", () => {
  it("should extract handler for matching tag", () => {
    const store = createStore(CounterState.Ready({ value: 10 }), CounterState, {
      name: "Counter",
    });
    const state = store.stateValue;

    const handlers = {
      Idle: (s: typeof state) => s.value * 2,
      Ready: (s: typeof state) => s.value * 3,
      Loading: () => 0,
      Error: () => -1,
    };

    const result = on("Ready")(handlers.Ready)(state);
    expect(result).toBe(30);
  });

  it("should return undefined for non-matching tag", () => {
    const store = createStore(CounterState.Ready({ value: 10 }), CounterState, {
      name: "Counter",
    });
    const state = store.stateValue;

    const result = on("Idle")((s: typeof state) => s.value)(state);
    expect(result).toBeUndefined();
  });
});

describe("withState()", () => {
  it("should execute callback when state matches tag", () => {
    const store = createStore(CounterState.Ready({ value: 25 }), CounterState, {
      name: "Counter",
    });

    const result = withState(store.stateValue, "Ready", (s) => s.value * 2);
    expect(result).toBe(50);
  });

  it("should return undefined when state doesn't match", () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "Counter",
    });

    const result = withState(store.stateValue, "Ready", (s) => s.value);
    expect(result).toBeUndefined();
  });
});

describe("getTag()", () => {
  it("should return state tag", () => {
    const store = createStore(CounterState.Ready({ value: 10 }), CounterState, {
      name: "Counter",
    });

    expect(getTag(store.stateValue)).toBe("Ready");
  });
});

describe("isInState()", () => {
  it("should check if store state matches tag", () => {
    const store = createStore(CounterState.Ready({ value: 10 }), CounterState, {
      name: "Counter",
    });

    expect(isInState(store, "Ready")).toBe(true);
    expect(isInState(store, "Idle")).toBe(false);
    expect(isInState(store, "Loading")).toBe(false);
    expect(isInState(store, "Error")).toBe(false);
  });
});
