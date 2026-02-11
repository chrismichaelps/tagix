import { describe, it, expect } from "vitest";
import {
  select,
  pluck,
  memoize,
  combineSelectors,
  patch,
  getOrDefault,
  taggedEnum,
  createStore,
} from "../../index";

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
    expect(callCount).toBe(1);
  });

  it("should handle different inputs", () => {
    let callCount = 0;
    const memoized = memoize((n: { value: number }) => {
      callCount++;
      return n.value * n.value;
    });

    const input1 = { value: 2 };
    expect(memoized(input1)).toBe(4);
    expect(callCount).toBe(1);

    expect(memoized(input1)).toBe(4);
    expect(callCount).toBe(1);

    const input2 = { value: 3 };
    expect(memoized(input2)).toBe(9);
    expect(callCount).toBe(2);
  });
});

describe("combineSelectors()", () => {
  it("should combine multiple selectors", () => {
    const getValue = (s: { value: number; _tag: string }) => s.value;
    const getTag = (s: { value: number; _tag: string }) => s._tag;

    const combined = combineSelectors(getValue, getTag);
    const result = combined({ value: 20, _tag: "Ready" });

    expect(result[0]).toBe(20);
    expect(result[1]).toBe("Ready");
  });

  it("should support multiple selector combination", () => {
    const getValue = (s: { value: number; _tag: string; active?: boolean }) => s.value;
    const getTag = (s: { value: number; _tag: string; active?: boolean }) => s._tag;
    const getActive = (s: { value: number; _tag: string; active?: boolean }) => s.active ?? false;

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

    expect(patched.value.value).toBe(5);
    expect(patched.value.name).toBe("test");
    expect(patched.value.active).toBe(true);
    expect(patched.value).not.toBe(base);
  });

  it("should handle partial updates", () => {
    const base = { x: 1, y: 2, z: 3 };
    const patched = patch(base)({ y: 20 });

    expect(patched.value).toEqual({ x: 1, y: 20, z: 3 });
  });

  it("should support chained updates", () => {
    const base = { x: 1, y: 2, z: 3 };

    const result1 = patch(base)({ x: 10 });
    const result2 = result1({ y: 20 });

    expect(result2.value).toEqual({ x: 10, y: 20, z: 3 });
  });
});

describe("getOrDefault()", () => {
  it("should provide default value for undefined results", () => {
    const getter = (input: { value?: number }) => input.value;

    const withDefault = getOrDefault(0);
    expect(withDefault(getter({ value: 5 }))).toBe(5);
    expect(withDefault(getter({ value: undefined }))).toBe(0);
    expect(withDefault(getter({}))).toBe(0);
  });

  it("should work with different default types", () => {
    const getter = (input: { name?: string }) => input.name;

    const withDefault = getOrDefault("Unknown");
    expect(withDefault(getter({ name: "Chris" }))).toBe("Chris");
    expect(withDefault(getter({}))).toBe("Unknown");
  });
});

describe("Complete Selector Example", () => {
  it("should work with store selectors", () => {
    const UserState = taggedEnum({
      Idle: { user: null },
      Loading: {},
      Ready: { user: { name: "", email: "", age: 0 } },
      Error: { message: "" },
    });

    const store = createStore(
      UserState.Ready({
        user: { name: "Red", email: "red@test.com", age: 25 },
      }),
      UserState
    );

    const userName = select((store.stateValue as { user: { name: string } }).user, "name");
    expect(userName).toBe("Red");

    const getUserName = pluck("user.name");
    const readyState = store.stateValue as { user: { name: string; age: number } };
    const name = getUserName(readyState);
    expect(name).toBe("Red");

    let callCount = 0;
    const computeScore = memoize((user: { age: number }) => {
      callCount++;
      return user.age * 10;
    });

    const userForMemo = { age: 25 };
    expect(computeScore(userForMemo)).toBe(250);
    expect(callCount).toBe(1);
    expect(computeScore(userForMemo)).toBe(250);
    expect(callCount).toBe(1);

    const getUserInfo = combineSelectors(
      (s: { user: { name: string; age: number } }) => s.user.name,
      (s: { user: { age: number } }) => s.user.age
    );

    const [userNameResult, userAge] = getUserInfo(readyState);
    expect(userNameResult).toBe("Red");
    expect(userAge).toBe(25);

    const updateUser = patch(
      (store.stateValue as { user: { name: string; email: string; age: number } }).user
    )({ age: 26 });
    expect(updateUser.value.age).toBe(26);
    expect(updateUser.value.name).toBe("Red");
  });

  it("should handle derived state patterns", () => {
    const getFullName = (user: { first: string; last: string }) => `${user.first} ${user.last}`;

    const user = { first: "John", last: "Doe" };
    expect(getFullName(user)).toBe("John Doe");
  });

  it("should handle conditional selection", () => {
    const getDisplayName = (user: { displayName?: string; username: string }) => {
      const display = select(user, "displayName");
      return display ?? user.username;
    };

    expect(getDisplayName({ displayName: "JD", username: "john" })).toBe("JD");
    expect(getDisplayName({ username: "john" })).toBe("john");
  });
});
