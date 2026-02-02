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

describe("Middleware Control Flow", () => {
  it("should allow middlewares to block async actions", async () => {
    let effectWasCalled = false;
    let middlewareBlocked = false;

    const blockingMiddleware = () => (next: (action: any) => boolean) => (action: any) => {
      if (action.type.includes("Blocked")) {
        middlewareBlocked = true;
        return false;
      }
      return next(action);
    };

    const TestState = taggedEnum({
      Idle: { value: 0 },
      Loading: { value: 0 },
      Ready: { value: 0 },
    });

    type TestStateType = typeof TestState.State;

    const store = createStore<TestStateType>(TestState.Idle({ value: 0 }), TestState, {
      middlewares: [blockingMiddleware as any],
    });

    const blockedAsync = createAsyncAction<void, TestStateType, void>("BlockedAsync")
      .state((s) => TestState.Loading({ value: 99 }))
      .effect(async () => {
        effectWasCalled = true;
      })
      .onSuccess((s) => s)
      .onError((s) => s);

    store.register("BlockedAsync", blockedAsync);

    await store.dispatch("tagix/action/BlockedAsync", {});

    expect(middlewareBlocked).toBe(true);
    expect(effectWasCalled).toBe(false);
    expect(store.stateValue._tag).toBe("Idle");
  });

  it("should allow middleware to modify action's state function", async () => {
    let stateModifiedByMiddleware = false;

    const modifyStateMiddleware = () => (next: (action: any) => boolean) => (action: any) => {
      if (action.type.includes("ModifyState")) {
        const originalState = action.state;
        action.state = (s: any) => {
          stateModifiedByMiddleware = true;
          return { ...originalState(s), _tag: "Ready" as const };
        };
      }
      return next(action);
    };

    const TestState = taggedEnum({
      Idle: { value: 0 },
      Loading: { value: 0 },
      Ready: { value: 0 },
    });

    type TestStateType = typeof TestState.State;

    const store = createStore<TestStateType>(TestState.Idle({ value: 0 }), TestState, {
      middlewares: [modifyStateMiddleware as any],
    });

    const modifyAction = createAsyncAction<void, TestStateType, number>("ModifyState")
      .state((s) => ({ ...s, _tag: "Loading" as const, value: 10 }))
      .effect(async () => 42)
      .onSuccess((s, result) => ({ ...s, value: result }))
      .onError((s) => s);

    store.register("ModifyState", modifyAction);

    await store.dispatch("tagix/action/ModifyState", {});

    expect(stateModifiedByMiddleware).toBe(true);
    expect(store.stateValue._tag).toBe("Ready");
  });

  it("should allow middleware to modify payload before async action executes", async () => {
    const receivedPayloads: number[] = [];

    const modifyPayloadMiddleware = () => (next: (action: any) => boolean) => (action: any) => {
      if (action.type.includes("Multiply")) {
        action.payload = action.payload * 2;
      }
      return next(action);
    };

    const TestState = taggedEnum({
      Idle: { value: 0 },
      Ready: { value: 0 },
    });

    type TestStateType = typeof TestState.State;

    const store = createStore<TestStateType>(TestState.Idle({ value: 0 }), TestState, {
      middlewares: [modifyPayloadMiddleware as any],
    });

    const multiplyAction = createAsyncAction<number, TestStateType, number>("Multiply")
      .state((s) => s)
      .effect(async (payload) => {
        receivedPayloads.push(payload);
        return payload;
      })
      .onSuccess((s, result) => ({ ...s, _tag: "Ready" as const, value: result }))
      .onError((s) => s);

    store.register("Multiply", multiplyAction);

    await store.dispatch("tagix/action/Multiply", 5);

    expect(receivedPayloads).toEqual([10]);
    expect((store.stateValue as Extract<TestStateType, { value: number }>).value).toBe(10);
  });
});
