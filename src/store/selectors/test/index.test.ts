import { describe, it, expect } from "vitest";
import { select, pluck, memoize, combineSelectors, patch, taggedEnum } from "../../index";

const CounterState = taggedEnum({
  Idle: { value: 0 },
  Loading: {},
  Ready: { value: 0 },
  Error: { message: "" },
});

describe("select()", () => {
  it("should return property value when key exists", () => {
    const obj = { value: 10, name: "test" };
    expect(select(obj, "value")).toBe(10);
    expect(select(obj, "name")).toBe("test");
  });

  it("should return undefined when key doesn't exist", () => {
    const obj = { value: 10 };
    expect(select(obj, "missing" as keyof typeof obj)).toBeUndefined();
  });
});

describe("pluck()", () => {
  it("should return curried selector", () => {
    const obj = { value: 10, name: "test" };
    const getValue = pluck("value");
    const getName = pluck("name");

    expect(getValue(obj)).toBe(10);
    expect(getName(obj)).toBe("test");
  });

  it("should work with tagged enum state", () => {
    const state = CounterState.Ready({ value: 42 });
    const getValue = pluck("value");
    const getTag = pluck("_tag");

    expect(getValue(state)).toBe(42);
    expect(getTag(state)).toBe("Ready");
  });
});

describe("memoize()", () => {
  it("should cache results for same input", () => {
    let callCount = 0;
    const memoized = memoize((input: { value: number }) => {
      callCount++;
      return input.value * 2;
    });

    const obj = { value: 5 };

    expect(memoized(obj)).toBe(10);
    expect(callCount).toBe(1);

    expect(memoized(obj)).toBe(10);
    expect(callCount).toBe(1);

    const obj2 = { value: 5 };
    expect(memoized(obj2)).toBe(10);
    expect(callCount).toBe(2);
  });

  it("should handle different inputs", () => {
    let callCount = 0;
    const memoized = memoize((n: number) => {
      callCount++;
      return n * n;
    });

    expect(memoized(2)).toBe(4);
    expect(callCount).toBe(1);

    expect(memoized(2)).toBe(4);
    expect(callCount).toBe(1);

    expect(memoized(3)).toBe(9);
    expect(callCount).toBe(2);
  });
});

describe("combineSelectors()", () => {
  it("should combine multiple selectors", () => {
    const getValue = (s: { value: number }) => s.value;
    const getTag = (s: { _tag: string }) => s._tag;

    const combined = combineSelectors(getValue, getTag);
    const result = combined({ value: 20, _tag: "Ready" });

    expect(result[0]).toBe(20);
    expect(result[1]).toBe("Ready");
  });

  it("should support multiple selector combination", () => {
    const getValue = (s: { value: number }) => s.value;
    const getTag = (s: { _tag: string }) => s._tag;
    const getActive = (s: { active?: boolean }) => s.active ?? false;

    const combined = combineSelectors(getValue, getTag, getActive);
    const result = combined({ value: 30, _tag: "Ready", active: true });

    expect(result[0]).toBe(30);
    expect(result[1]).toBe("Ready");
    expect(result[2]).toBe(true);
  });
});

describe("patch()", () => {
  it("should create updated object", () => {
    const base = { value: 0, name: "test", active: true };
    const patched = patch(base)({ value: 5 });

    expect(patched.value).toBe(5);
    expect(patched.name).toBe("test");
    expect(patched.active).toBe(true);
    expect(patched).not.toBe(base);
  });

  it("should handle partial updates", () => {
    const base = { x: 1, y: 2, z: 3 };
    const patched = patch(base)({ y: 20 });

    expect(patched).toEqual({ x: 1, y: 20, z: 3 });
  });
});
