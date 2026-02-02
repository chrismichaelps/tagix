import { describe, it, expect } from "vitest";
import {
  createStore,
  createAction,
  createAsyncAction,
  createLoggerMiddleware,
  taggedEnum,
} from "../../index";
import { getValue } from "../../test/utils";
import { isNotNullish } from "../../../lib/Data/predicate";

const CounterState = taggedEnum({
  Idle: { value: 0 },
  Loading: {},
  Ready: { value: 0 },
  Error: { message: "" },
});

type CounterStateType = typeof CounterState.State;

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
    const logger = isNotNullish(createLoggerMiddleware) ? createLoggerMiddleware({}) : undefined;
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "LoggerTest",
      middlewares: logger ? [logger] : [],
    });

    expect(store.name).toBe("LoggerTest");
  });

  it("should log actions when used with dispatch", () => {
    const logger = isNotNullish(createLoggerMiddleware) ? createLoggerMiddleware({}) : undefined;
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "LoggerDispatchTest",
      middlewares: logger ? [logger] : [],
    });

    const increment = createAction<{ amount: number }, CounterStateType>("Increment")
      .withPayload({ amount: 1 })
      .withState((s, p) => {
        const state = s as Extract<CounterStateType, { value: number }>;
        return { ...s, value: state.value + p.amount };
      });

    store.register("Increment", increment);
    store.dispatch("tagix/action/Increment", { amount: 5 });

    expect(store.stateValue._tag).toBe("Idle");
    expect(getValue(store.stateValue)).toBe(5);
  });

  it("should support custom predicate", () => {
    const logger = isNotNullish(createLoggerMiddleware)
      ? createLoggerMiddleware({
          predicate: (action) => action.type.includes("Increment"),
        })
      : undefined;

    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "PredicateTest",
      middlewares: logger ? [logger] : [],
    });

    expect(store.name).toBe("PredicateTest");
  });

  it("should support stateTransformer option", () => {
    const logger = isNotNullish(createLoggerMiddleware)
      ? createLoggerMiddleware({
          stateTransformer: (state) => ({
            transformed: true,
            value: getValue(state as CounterStateType),
          }),
        })
      : undefined;

    const store = createStore(CounterState.Idle({ value: 10 }), CounterState, {
      name: "TransformerTest",
      middlewares: logger ? [logger] : [],
    });

    expect(getValue(store.stateValue)).toBe(10);
  });

  it("should support actionTransformer option", () => {
    const logger = isNotNullish(createLoggerMiddleware)
      ? createLoggerMiddleware({
          actionTransformer: (action) => Object.assign({}, action, { transformed: true }),
        })
      : undefined;

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
      Success: { data: null as string | null },
      Error: { message: "" },
    });

    type AppStateType = typeof AppState.State;

    const store = createStore(AppState.Idle({}), AppState, {
      name: "AppAsync",
      middlewares: [createLoggerMiddleware({ collapsed: true, duration: true })],
    });

    const fetchData = createAsyncAction<undefined, AppStateType, string>("FetchData")
      .state((s) => ({ ...s, _tag: "Loading" as const }))
      .effect(async () => "test-data")
      .onSuccess((s, data) => ({ ...s, _tag: "Success" as const, data }))
      .onError((s, error) => ({
        ...s,
        _tag: "Error" as const,
        message: error instanceof Error ? error.message : "Unknown error",
      }));

    store.register("FetchData", fetchData);
    await store.dispatch("tagix/action/FetchData", undefined);

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

  it("should support collapsed option", () => {
    const logger = createLoggerMiddleware({ collapsed: true });
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "CollapsedTest",
      middlewares: [logger],
    });

    expect(store.name).toBe("CollapsedTest");
  });

  it("should support duration option", () => {
    const logger = createLoggerMiddleware({ duration: true });
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "DurationTest",
      middlewares: [logger],
    });

    expect(store.name).toBe("DurationTest");
  });

  it("should support timestamp option", () => {
    const logger = createLoggerMiddleware({ timestamp: true });
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "TimestampTest",
      middlewares: [logger],
    });

    expect(store.name).toBe("TimestampTest");
  });

  it("should support level option", () => {
    const loggerInfo = createLoggerMiddleware({ level: "info" });
    const loggerWarn = createLoggerMiddleware({ level: "warn" });
    const loggerError = createLoggerMiddleware({ level: "error" });

    expect(loggerInfo).toBeDefined();
    expect(loggerWarn).toBeDefined();
    expect(loggerError).toBeDefined();
  });

  it("should support predicate option for filtering actions", () => {
    const logger = createLoggerMiddleware({
      predicate: (action) => !action.type.includes("DEBUG"),
    });

    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "PredicateTest",
      middlewares: [logger],
    });

    expect(store.name).toBe("PredicateTest");
  });

  it("should support stateTransformer option", () => {
    const logger = createLoggerMiddleware({
      stateTransformer: (state) => ({
        transformed: true,
        value: getValue(state as CounterStateType),
      }),
    });

    const store = createStore(CounterState.Idle({ value: 10 }), CounterState, {
      name: "StateTransformerTest",
      middlewares: [logger],
    });

    expect(store.name).toBe("StateTransformerTest");
  });

  it("should support actionTransformer option", () => {
    const logger = createLoggerMiddleware({
      actionTransformer: (action) => Object.assign({}, action, { transformed: true }),
    });

    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "ActionTransformerTest",
      middlewares: [logger],
    });

    expect(store.name).toBe("ActionTransformerTest");
  });
});
