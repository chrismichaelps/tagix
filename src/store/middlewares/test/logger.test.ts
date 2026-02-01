import { describe, it, expect } from "vitest";
import {
  createStore,
  createAction,
  createAsyncAction,
  createLoggerMiddleware,
  taggedEnum,
} from "../../index";

const CounterState = taggedEnum({
  Idle: { value: 0 },
  Loading: {},
  Ready: { value: 0 },
  Error: { message: "" },
});

describe("createLoggerMiddleware", () => {
  it("should create middleware object", () => {
    const middleware = createLoggerMiddleware();
    expect(middleware).toBeDefined();
    expect(typeof middleware).toBe("function");
  });

  it("should accept options", () => {
    const middleware = createLoggerMiddleware({
      collapsed: true,
      duration: true,
      timestamp: true,
      level: "info",
      diff: true,
    });

    expect(middleware).toBeDefined();
  });

  it("should work with store", () => {
    const logger = createLoggerMiddleware?.({});
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "LoggerTest",
      middlewares: logger ? [logger] : [],
    });

    expect(store.name).toBe("LoggerTest");
  });

  it("should log actions when used with dispatch", () => {
    const logger = createLoggerMiddleware?.({});
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "LoggerDispatchTest",
      middlewares: logger ? [logger] : [],
    });

    const increment = createAction("Increment")
      .withPayload({ amount: 1 } as { amount: number })
      .withState((s, p) => ({ ...s, value: s.value + p.amount }));

    store.register("Increment", increment);
    store.dispatch("tagix/action/Increment", { amount: 5 });

    expect(store.stateValue._tag).toBe("Idle");
    expect((store.stateValue as { value: number }).value).toBe(1);
  });

  it("should support custom predicate", () => {
    const logger = createLoggerMiddleware?.({
      predicate: (action) => action.type.includes("Increment"),
    });

    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "PredicateTest",
      middlewares: logger ? [logger] : [],
    });

    expect(store.name).toBe("PredicateTest");
  });

  it("should support stateTransformer option", () => {
    const logger = createLoggerMiddleware?.({
      stateTransformer: (state) => ({
        transformed: true,
        value: (state as { value: number }).value,
      }),
    });

    const store = createStore(CounterState.Idle({ value: 10 }), CounterState, {
      name: "TransformerTest",
      middlewares: logger ? [logger] : [],
    });

    expect((store.stateValue as { value: number }).value).toBe(10);
  });

  it("should support actionTransformer option", () => {
    const logger = createLoggerMiddleware?.({
      actionTransformer: (action) => ({ ...action, transformed: true }),
    });

    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "ActionTransformerTest",
      middlewares: logger ? [logger] : [],
    });

    expect(store.name).toBe("ActionTransformerTest");
  });

  it("should work with async actions", async () => {
    const AppState = taggedEnum({
      Idle: {},
      Loading: {},
      Success: { data: null },
      Error: { message: "" },
    });

    const store = createStore(AppState.Idle(), AppState, {
      name: "AppAsync",
      middlewares: [createLoggerMiddleware({ collapsed: true, duration: true })],
    });

    const fetchData = createAsyncAction("FetchData")
      .state((s) => ({ ...s, _tag: "Loading" }))
      .effect(async () => "test-data")
      .onSuccess((s, data) => ({ ...s, _tag: "Success", data }))
      .onError((s, error) => ({ ...s, _tag: "Error", message: error.message }));

    store.register("FetchData", fetchData);
    await store.dispatch("tagix/action/FetchData", {});

    expect(store.stateValue._tag).toBe("Success");
  });

  it("should handle disabled for production pattern", () => {
    const logger =
      process.env.NODE_ENV === "development"
        ? createLoggerMiddleware({ collapsed: true })
        : undefined;

    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "ProdTest",
      middlewares: logger ? [logger] : [],
    });

    expect(store).toBeDefined();
  });
});
