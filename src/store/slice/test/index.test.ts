import { describe, it, expect, expectTypeOf } from "vitest";
import { createSlice, taggedEnum } from "../../index";

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
});
