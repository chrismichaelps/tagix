import { describe, it, expect, expectTypeOf } from "vitest";
import {
  createSlice,
  createAsyncAction,
  createAction,
  createActionGroup,
  createStore,
  bindActions,
  taggedEnum,
} from "../../index";

const CounterState = taggedEnum({
  Idle: { value: 0 },
  Ready: { value: 0 },
});
type CounterStateType = typeof CounterState.State;

function makeCounter() {
  return createSlice({
    state: CounterState.Idle({ value: 0 }),
    schema: CounterState,
    actions: {
      increment: (s, p: { amount: number }) => CounterState.Ready({ value: s.value + p.amount }),
      set: (_s, p: { value: number }) => CounterState.Ready({ value: p.value }),
      reset: () => CounterState.Idle({ value: 0 }),
    },
  });
}

const value = (s: CounterStateType) => (s as Extract<CounterStateType, { value: number }>).value;

describe("createSlice", () => {
  it("auto-registers transitions and updates state via bound dispatchers", () => {
    const counter = makeCounter();

    counter.actions.increment({ amount: 5 });
    expect(counter.store.stateValue._tag).toBe("Ready");
    expect(value(counter.store.stateValue)).toBe(5);

    counter.actions.increment({ amount: 3 });
    expect(value(counter.store.stateValue)).toBe(8);

    counter.actions.reset();
    expect(counter.store.stateValue._tag).toBe("Idle");
    expect(value(counter.store.stateValue)).toBe(0);
  });

  it("infers a payload parameter per transition (and none when omitted)", () => {
    const counter = makeCounter();
    expectTypeOf(counter.actions.increment).parameters.toEqualTypeOf<[{ amount: number }]>();
    expectTypeOf(counter.actions.set).parameters.toEqualTypeOf<[{ value: number }]>();
    expectTypeOf(counter.actions.reset).parameters.toEqualTypeOf<[]>();
  });

  it("exposes the underlying store for selectors and subscriptions", () => {
    const counter = makeCounter();
    counter.actions.set({ value: 42 });
    expect(counter.store.select((s) => s.value)).toBe(42);

    const seen: number[] = [];
    const unsubscribe = counter.store.subscribe((s) => seen.push(value(s)));
    counter.actions.increment({ amount: 1 });
    unsubscribe();
    expect(seen).toEqual([42, 43]); // initial emit + after increment
  });

  it("registers actions so the underlying store also accepts string dispatch", () => {
    const counter = makeCounter();
    counter.store.dispatch("set", { value: 99 });
    expect(value(counter.store.stateValue)).toBe(99);
  });

  it("applies store config (e.g. name)", () => {
    const counter = createSlice({
      state: CounterState.Idle({ value: 0 }),
      schema: CounterState,
      actions: { reset: () => CounterState.Idle({ value: 0 }) },
      config: { name: "counter-slice" },
    });
    expect(counter.store.name).toBe("counter-slice");
  });

  describe("async actions inline", () => {
    const ApiState = taggedEnum({
      Idle: {},
      Loading: {},
      Ready: { data: "" },
      Failed: { message: "" },
    });
    type ApiStateType = typeof ApiState.State;

    function makeApi() {
      return createSlice({
        state: ApiState.Idle({}),
        schema: ApiState,
        actions: {
          reset: () => ApiState.Idle({}),
          load: createAsyncAction<{ id: string }, ApiStateType, string>("Load")
            .state(() => ApiState.Loading({}))
            .effect(async (p) => {
              if (p.id === "boom") throw new Error("network down");
              return `data-${p.id}`;
            })
            .onSuccess((_s, data) => ApiState.Ready({ data }))
            .onError((_s, e) => ApiState.Failed({ message: e instanceof Error ? e.message : "?" })),
        },
      });
    }

    it("infers an async dispatcher returning Promise<void>", () => {
      const api = makeApi();
      expectTypeOf(api.actions.load).toEqualTypeOf<(payload: { id: string }) => Promise<void>>();
      expectTypeOf(api.actions.reset).toEqualTypeOf<() => void>();
    });

    it("runs the effect and applies onSuccess", async () => {
      const api = makeApi();
      await api.actions.load({ id: "42" });
      expect(api.store.stateValue._tag).toBe("Ready");
      expect((api.store.stateValue as Extract<ApiStateType, { data: string }>).data).toBe(
        "data-42"
      );
    });

    it("applies onError when the effect throws", async () => {
      const api = makeApi();
      await api.actions.load({ id: "boom" });
      expect(api.store.stateValue._tag).toBe("Failed");
      expect((api.store.stateValue as Extract<ApiStateType, { message: string }>).message).toBe(
        "network down"
      );
    });
  });
});

describe("bindActions", () => {
  const incrementAction = createAction<{ amount: number }, CounterStateType>("Increment").withState(
    (s, p) => CounterState.Ready({ value: s.value + p.amount })
  );
  const resetAction = createAction<void, CounterStateType>("Reset").withState(() =>
    CounterState.Idle({ value: 0 })
  );

  it("registers a group and returns typed bound dispatchers", () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState);
    const group = createActionGroup("Counter", {
      increment: incrementAction,
      reset: resetAction,
    });
    const actions = bindActions(store, group);

    actions.increment({ amount: 5 });
    expect(value(store.stateValue)).toBe(5);

    actions.reset();
    expect(store.stateValue._tag).toBe("Idle");
  });

  it("infers the payload type per action", () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState);
    const actions = bindActions(store, { increment: incrementAction });
    expectTypeOf(actions.increment).toEqualTypeOf<(payload: { amount: number }) => void>();
  });

  it("binds async actions to Promise-returning dispatchers", async () => {
    const ApiState = taggedEnum({ Idle: {}, Loading: {}, Ready: { data: "" } });
    type ApiStateType = typeof ApiState.State;

    const load = createAsyncAction<{ id: string }, ApiStateType, string>("Load")
      .state(() => ApiState.Loading({}))
      .effect(async (p) => `data-${p.id}`)
      .onSuccess((_s, data) => ApiState.Ready({ data }))
      .onError((s) => s);

    const store = createStore(ApiState.Idle({}), ApiState);
    const actions = bindActions(store, { load });

    expectTypeOf(actions.load).toEqualTypeOf<(payload: { id: string }) => Promise<void>>();

    await actions.load({ id: "7" });
    expect(store.stateValue._tag).toBe("Ready");
    expect((store.stateValue as Extract<ApiStateType, { data: string }>).data).toBe("data-7");
  });
});
