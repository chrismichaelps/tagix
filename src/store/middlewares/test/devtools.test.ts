import { describe, it, expect, vi } from "vitest";
import {
  createStore,
  createAction,
  createDevtoolsMiddleware,
  taggedEnum,
  type DevtoolsConnection,
  type DevtoolsConnector,
} from "../../index";

const CounterState = taggedEnum({
  Idle: { value: 0 },
  Ready: { value: 0 },
});
type CounterStateType = typeof CounterState.State;

function mockConnector() {
  const sent: Array<{ action: { type: string }; state: unknown }> = [];
  let initial: unknown;
  const connection: DevtoolsConnection = {
    init: (state) => {
      initial = state;
    },
    send: (action, state) => {
      sent.push({ action, state });
    },
  };
  const connect = vi.fn((_options: { name?: string }) => connection);
  const connector: DevtoolsConnector = { connect };
  return { connector, connect, sent, getInitial: () => initial };
}

const increment = createAction<{ amount: number }, CounterStateType>("Increment").withState(
  (s, p) =>
    CounterState.Ready({
      value: (s as Extract<CounterStateType, { value: number }>).value + p.amount,
    })
);

describe("createDevtoolsMiddleware", () => {
  it("connects with the configured name and seeds the initial state", () => {
    const m = mockConnector();
    createStore(CounterState.Idle({ value: 0 }), CounterState, {
      middlewares: [createDevtoolsMiddleware({ name: "App", connector: m.connector })],
    });

    expect(m.connect).toHaveBeenCalledWith({ name: "App" });
    expect(m.getInitial()).toEqual({ _tag: "Idle", value: 0 });
  });

  it("sends each dispatched action with the resulting state", () => {
    const m = mockConnector();
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      middlewares: [createDevtoolsMiddleware({ connector: m.connector })],
    });
    store.register("Increment", increment);

    store.dispatch(increment, { amount: 5 });

    expect(m.sent).toHaveLength(1);
    expect(m.sent[0].action).toEqual({ type: "tagix/action/Increment" });
    expect(m.sent[0].state).toEqual({ _tag: "Ready", value: 5 });
  });

  it("does not block dispatch", () => {
    const m = mockConnector();
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      middlewares: [createDevtoolsMiddleware({ connector: m.connector })],
    });
    store.register("Increment", increment);

    store.dispatch(increment, { amount: 3 });
    expect((store.stateValue as Extract<CounterStateType, { value: number }>).value).toBe(3);
  });

  it("is an inert pass-through when no connector is available", () => {
    const g = globalThis as { __REDUX_DEVTOOLS_EXTENSION__?: DevtoolsConnector };
    const saved = g.__REDUX_DEVTOOLS_EXTENSION__;
    delete g.__REDUX_DEVTOOLS_EXTENSION__;
    try {
      const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
        middlewares: [createDevtoolsMiddleware()],
      });
      store.register("Increment", increment);
      expect(() => store.dispatch(increment, { amount: 1 })).not.toThrow();
      expect((store.stateValue as Extract<CounterStateType, { value: number }>).value).toBe(1);
    } finally {
      if (saved !== undefined) g.__REDUX_DEVTOOLS_EXTENSION__ = saved;
    }
  });
});
