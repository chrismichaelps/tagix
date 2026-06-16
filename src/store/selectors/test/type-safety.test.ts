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
});
