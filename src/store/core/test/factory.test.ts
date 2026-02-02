import { describe, it, expect } from "vitest";
import { createStore, createAction, taggedEnum } from "../../index";
import { getValue } from "../../test/utils";

const CounterState = taggedEnum({
  Idle: { value: 0 },
  Loading: {},
  Ready: { value: 0 },
  Error: { message: "", code: 0 },
});

type CounterStateType = typeof CounterState.State;

describe("Store Basic", () => {
  it("should create store with initial state", () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "Counter",
    });
    expect(store.stateValue._tag).toBe("Idle");
    expect(getValue(store.stateValue)).toBe(0);
  });

  it("should return correct store name", () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "Counter",
    });
    expect(store.name).toBe("Counter");
  });

  it("should default to 'TagixStore' when no name provided", () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState);
    expect(store.name).toBe("TagixStore");
  });

  it("should track registered actions", () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState);
    expect(store.registeredActions).toEqual([]);
  });

  it("should support middlewares configuration", () => {
    const loggerMiddleware = createStoreLoggerMiddleware?.({});
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "MiddlewareTest",
      middlewares: loggerMiddleware ? [loggerMiddleware] : [],
    });
    expect(store.name).toBe("MiddlewareTest");
  });
});

import { createLoggerMiddleware as createStoreLoggerMiddleware } from "../../middlewares/logger";

describe("Store Edge Cases", () => {
  it("should handle rapid state updates", () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "RapidTest",
    });

    const increment = createAction<{ amount: number }, CounterStateType>("Increment")
      .withPayload({ amount: 1 })
      .withState((s, p) => ({ ...s, value: s.value + p.amount }));

    store.register("Increment", increment);

    const startTime = Date.now();
    for (let i = 0; i < 1000; i++) {
      store.dispatch("tagix/action/Increment", { amount: 1 });
    }
    const endTime = Date.now();

    expect(getValue(store.stateValue)).toBe(1000);
    expect(endTime - startTime).toBeLessThan(100);
  });

  it("should handle multiple subscribers", () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "Subscribers",
    });

    let callCount1 = 0;
    let callCount2 = 0;

    const unsub1 = store.subscribe(() => callCount1++);
    const unsub2 = store.subscribe(() => callCount2++);

    const increment = createAction<{ amount: number }, CounterStateType>("Increment")
      .withPayload({ amount: 1 })
      .withState((s, p) => ({ ...s, value: s.value + p.amount }));

    store.register("Increment", increment);
    store.dispatch("tagix/action/Increment", { amount: 1 });

    expect(callCount1).toBe(1);
    expect(callCount2).toBe(1);

    unsub1();
    store.dispatch("tagix/action/Increment", { amount: 1 });

    expect(callCount1).toBe(1);
    expect(callCount2).toBe(2);
  });

  it("should track error history", () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "ErrorHistory",
    });

    const failAction = createAction<undefined, CounterStateType>("Fail")
      .withPayload(undefined)
      .withState(() => {
        throw new Error("Test error");
      });

    store.register("Fail", failAction);

    try {
      store.dispatch("tagix/action/Fail", undefined);
    } catch {}

    expect(store.errorHistory.length).toBeGreaterThan(0);
    expect(store.lastError).toBeDefined();
  });

  it("should track errors with code", () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "ErrorCodes",
    });

    const errorAction = createAction<undefined, CounterStateType>("ErrorAction")
      .withPayload(undefined)
      .withState(() => {
        throw new Error("Test error");
      });

    store.register("ErrorAction", errorAction);

    try {
      store.dispatch("tagix/action/ErrorAction", undefined);
    } catch {}

    expect(store.getTotalErrorCount()).toBeGreaterThan(0);
  });

  it("should handle isInState method", () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "IsInState",
    });

    expect(store.isInState("Idle")).toBe(true);
    expect(store.isInState("Ready")).toBe(false);
    expect(store.isInState("Loading")).toBe(false);
    expect(store.isInState("Error")).toBe(false);
  });

  it("should handle getState method", () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "GetState",
    });

    const idleState = store.getState("Idle");
    expect(idleState._tag).toBe("Some");
  });

  it("should handle select method", () => {
    const store = createStore(CounterState.Ready({ value: 99 }), CounterState, {
      name: "Select",
    });

    expect(store.select("value")).toBe(99);
    expect(store.select("_tag")).toBe("Ready");
    expect(store.select("nonexistent")).toBeUndefined();
  });

  it("should handle transitions method", () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "Transitions",
    });

    const transitions = store.transitions({
      Idle: (s) => ({ ...s, _tag: "Ready" as const, value: s.value }),
      Ready: (s) => ({ ...s, _tag: "Idle" as const, value: 0 }),
    });

    const idleState = CounterState.Idle({ value: 5 });
    const readyState = transitions(idleState);
    expect(readyState._tag).toBe("Ready");

    const backToIdle = transitions(readyState);
    expect(backToIdle._tag).toBe("Idle");
    expect(getValue(backToIdle)).toBe(0);
  });

  it("should handle registered actions list", () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "Registered",
    });

    expect(store.registeredActions).toEqual([]);

    const action1 = createAction<undefined, CounterStateType>("Action1")
      .withPayload(undefined)
      .withState((s) => s);
    const action2 = createAction<undefined, CounterStateType>("Action2")
      .withPayload(undefined)
      .withState((s) => s);

    store.register("Action1", action1);
    store.register("Action2", action2);

    expect(store.registeredActions).toContain("tagix/action/Action1");
    expect(store.registeredActions).toContain("tagix/action/Action2");
    expect(store.registeredActions.length).toBe(2);
  });

  it("should clear error history", () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "ClearErrors",
    });

    const failAction = createAction<undefined, CounterStateType>("Fail")
      .withPayload(undefined)
      .withState(() => {
        throw new Error("Test");
      });

    store.register("Fail", failAction);

    try {
      store.dispatch("tagix/action/Fail", undefined);
    } catch {}

    expect(store.getTotalErrorCount()).toBeGreaterThan(0);

    store.clearErrorHistory();

    expect(store.getTotalErrorCount()).toBe(0);
    expect(store.errorHistory.length).toBe(0);
  });
});
