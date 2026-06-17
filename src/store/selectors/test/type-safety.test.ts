import { describe, it, expect, expectTypeOf } from "vitest";
import { pluck, select, getOrDefault } from "../index";

describe("selector type safety", () => {
  it("pluck recovers the property type for a known single key", () => {
    const state = { value: 42, name: "x", _tag: "Ready" as const };

    const value = pluck("value")(state);
    expectTypeOf(value).toEqualTypeOf<number>();
    expect(value).toBe(42);

    const tag = pluck("_tag")(state);
    expectTypeOf(tag).toEqualTypeOf<"Ready">();
    expect(tag).toBe("Ready");
  });

  it("pluck falls back to unknown only for nested/dotted paths", () => {
    const state = { user: { name: "Chris" } };
    const name = pluck("user.name")(state);
    expectTypeOf(name).toEqualTypeOf<unknown>();
    expect(name).toBe("Chris");
  });

  it("select preserves the property value type", () => {
    const obj = { count: 7, label: "n" };
    const count = select(obj, "count");
    expectTypeOf(count).toEqualTypeOf<number | undefined>();
    expect(count).toBe(7);
  });

  it("getOrDefault preserves the value type", () => {
    const withDefault = getOrDefault(0);
    const n = withDefault(undefined);
    expectTypeOf(n).toEqualTypeOf<number>();
    expect(n).toBe(0);
  });

  it("select with a function accessor is fully typed for nested paths", () => {
    const state = { user: { name: "Chris", age: 30 }, _tag: "Ready" as const };

    const name = select(state, (s) => s.user.name);
    expectTypeOf(name).toEqualTypeOf<string | undefined>();
    expect(name).toBe("Chris");

    const age = select(state, (s) => s.user.age);
    expectTypeOf(age).toEqualTypeOf<number | undefined>();
    expect(age).toBe(30);
  });

  it("pluck<State>() infers the accessor parameter without typeof", () => {
    interface State {
      user: { name: string };
    }
    const state: State = { user: { name: "Chris" } };

    // `s` is inferred as State from the type argument — no annotation needed.
    const getName = pluck<State>()((s) => s.user.name);
    const name = getName(state);
    expectTypeOf(name).toEqualTypeOf<string | undefined>();
    expect(name).toBe("Chris");
  });
});
