import { describe, it, expect } from "vitest";
import {
  createStore,
  when,
  on,
  withState,
  getTag,
  isInState,
  hasTag,
  taggedEnum,
  asVariant,
  type TaggedEnum,
} from "../../index";

const CounterState = taggedEnum({
  Idle: { value: 0 },
  Loading: {},
  Ready: { value: 0 },
  Error: { message: "" },
});

type CounterStateType = typeof CounterState.State;

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
      const readyState = state as Extract<CounterStateType, { _tag: "Ready" }>;
      expect(readyState.value).toBe(42);
    }
  });
});

describe("on()", () => {
  it("should extract handler for matching tag", () => {
    const store = createStore(CounterState.Ready({ value: 10 }), CounterState, {
      name: "Counter",
    });
    const state = store.stateValue;

    const result = on("Ready")(
      (s) => (s as Extract<CounterStateType, { _tag: "Ready" }>).value * 3
    )(state);
    expect(result).toBe(30);
  });

  it("should return undefined for non-matching tag", () => {
    const store = createStore(CounterState.Ready({ value: 10 }), CounterState, {
      name: "Counter",
    });
    const state = store.stateValue;

    const result = on("Idle")((s) => (s as Extract<CounterStateType, { _tag: "Idle" }>).value)(
      state
    );
    expect(result).toBeUndefined();
  });
});

describe("withState()", () => {
  it("should execute callback when state matches tag", () => {
    const store = createStore(CounterState.Ready({ value: 25 }), CounterState, {
      name: "Counter",
    });

    const result = withState(
      store.stateValue,
      "Ready",
      (s) => (s as Extract<CounterStateType, { _tag: "Ready" }>).value * 2
    );
    expect(result).toBe(50);
  });

  it("should return undefined when state doesn't match", () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "Counter",
    });

    const result = withState(
      store.stateValue,
      "Ready",
      (s) => (s as Extract<CounterStateType, { _tag: "Ready" }>).value
    );
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

describe("hasTag()", () => {
  it("should check if any state has specific tag", () => {
    const store = createStore(CounterState.Ready({ value: 10 }), CounterState, {
      name: "Counter",
    });

    expect(hasTag(store.stateValue, "Ready")).toBe(true);
    expect(hasTag(store.stateValue, "Idle")).toBe(false);
    expect(hasTag(CounterState.Idle({ value: 0 }), "Idle")).toBe(true);
    expect(hasTag(CounterState.Loading({}), "Loading")).toBe(true);
  });
});

describe("Complete Guard Example", () => {
  it("should work with all guard functions together", () => {
    const AppState = taggedEnum({
      Idle: { data: null as null },
      Loading: { progress: 0 },
      Success: { data: [] as unknown[] },
      Error: { message: "" },
    });

    type AppStateType = TaggedEnum<{
      Idle: { data: null };
      Loading: { progress: number };
      Success: { data: unknown[] };
      Error: { message: string };
    }>;

    const store = createStore<AppStateType>(AppState.Loading({ progress: 50 }), AppState, {
      name: "App",
    });

    if (when<AppStateType, "Loading">("Loading")(store.stateValue)) {
      const loadingState = asVariant<AppStateType, "Loading">(store.stateValue, "Loading");
      expect(loadingState?.progress).toBe(50);
    }

    const progressHandler = on("Loading")(
      (s) => (s as Extract<AppStateType, { _tag: "Loading" }>).progress * 2
    );
    const doubled = progressHandler(store.stateValue);
    expect(doubled).toBe(100);

    const currentTag = getTag(store.stateValue);
    expect(currentTag).toBe("Loading");

    expect(isInState(store, "Loading")).toBe(true);
  });
});
