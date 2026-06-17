import { describe, it, expect, expectTypeOf } from "vitest";
import { getValue, getProperty } from "../state-utils";

type CounterState =
  | { readonly _tag: "Idle" }
  | { readonly _tag: "Ready"; readonly value: number; readonly meta: { label: string } };

// Indexing an array of the union keeps the full union type (avoids const-narrowing
// to a single variant), mirroring how state flows through a real store.
const states: readonly CounterState[] = [
  { _tag: "Idle" },
  { _tag: "Ready", value: 42, meta: { label: "count" } },
];
const idle = states[0];
const ready = states[1];

describe("getValue() with function accessor", () => {
  it("reads a nested value and infers its type", () => {
    const label = getValue(ready, (s) => (s._tag === "Ready" ? s.meta.label : undefined), "n/a");
    expectTypeOf(label).toEqualTypeOf<string | undefined>();
    expect(label).toBe("count");
  });

  it("returns the default when the accessor yields undefined", () => {
    const value = getValue(idle, (s) => (s._tag === "Ready" ? s.value : undefined), 0);
    expect(value).toBe(0);
  });

  it("returns the default when traversal throws", () => {
    const value = getValue(
      idle,
      (s) => (s as unknown as { value: { nested: number } }).value.nested,
      -1
    );
    expect(value).toBe(-1);
  });

  it("still supports the deprecated string key form", () => {
    expect(getValue(ready, "value", 0)).toBe(42);
    expect(getValue(idle, "value", 0)).toBe(0);
  });
});

describe("getProperty() with function accessor", () => {
  it("reads a value via an accessor", () => {
    const value = getProperty(ready, (s) => (s._tag === "Ready" ? s.value : undefined));
    expect(value).toBe(42);
  });

  it("returns undefined when the accessor throws", () => {
    const value = getProperty(
      idle,
      (s) => (s as unknown as { value: { nested: number } }).value.nested
    );
    expect(value).toBeUndefined();
  });

  it("still supports the deprecated string key form", () => {
    expect(getProperty(ready, "value")).toBe(42);
    expect(getProperty(idle, "value")).toBeUndefined();
  });
});
