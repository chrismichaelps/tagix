import { describe, it, expect, expectTypeOf } from "vitest";
import { Order, pipe } from "../index";

interface User {
  readonly name: string;
  readonly age: number;
}

const users: User[] = [
  { name: "Carol", age: 30 },
  { name: "Alice", age: 30 },
  { name: "Bob", age: 25 },
];

describe("primitive orders", () => {
  it("number sorts ascending", () => {
    expect(Order.number(1, 2)).toBe(-1);
    expect(Order.number(2, 2)).toBe(0);
    expect(Order.number(3, 2)).toBe(1);
  });

  it("number keeps a total order around NaN (NaN sorts last)", () => {
    expect(Order.number(NaN, 1)).toBe(1);
    expect(Order.number(1, NaN)).toBe(-1);
    expect(Order.number(NaN, NaN)).toBe(0);
    // sort() must place NaN at the end and not corrupt the rest
    const sorted = Order.sort(Order.number)([3, NaN, 1, 2]);
    expect(sorted.slice(0, 3)).toEqual([1, 2, 3]);
    expect(Number.isNaN(sorted[3])).toBe(true);
  });

  it("string sorts lexicographically", () => {
    expect(Order.string("a", "b")).toBe(-1);
    expect(Order.string("b", "b")).toBe(0);
    expect(Order.string("c", "b")).toBe(1);
  });

  it("boolean treats false < true", () => {
    expect(Order.boolean(false, true)).toBe(-1);
    expect(Order.boolean(true, true)).toBe(0);
    expect(Order.boolean(true, false)).toBe(1);
  });

  it("bigint sorts ascending", () => {
    expect(Order.bigint(1n, 2n)).toBe(-1);
    expect(Order.bigint(2n, 2n)).toBe(0);
  });

  it("date sorts earliest first", () => {
    expect(Order.date(new Date(1000), new Date(2000))).toBe(-1);
    expect(Order.date(new Date(2000), new Date(2000))).toBe(0);
  });
});

describe("reverse()", () => {
  it("flips an order", () => {
    const desc = Order.reverse(Order.number);
    expect(desc(1, 2)).toBe(1);
    expect(desc(2, 1)).toBe(-1);
  });
});

describe("mapInput()", () => {
  it("derives an order on a field", () => {
    const byAge = Order.mapInput(Order.number, (u: User) => u.age);
    expect(byAge(users[2], users[0])).toBe(-1); // 25 < 30
  });
});

describe("combine() / combineAll()", () => {
  it("uses the second order as a tie-breaker", () => {
    const byAge = Order.mapInput(Order.number, (u: User) => u.age);
    const byName = Order.mapInput(Order.string, (u: User) => u.name);
    const byAgeThenName = Order.combine(byAge, byName);

    // same age -> falls back to name
    expect(byAgeThenName({ name: "Alice", age: 30 }, { name: "Carol", age: 30 })).toBe(-1);
    // different age -> name ignored
    expect(byAgeThenName({ name: "Zoe", age: 25 }, { name: "Alice", age: 30 })).toBe(-1);
  });

  it("combineAll applies orders in priority sequence", () => {
    const byAge = Order.mapInput(Order.number, (u: User) => u.age);
    const byName = Order.mapInput(Order.string, (u: User) => u.name);
    const O = Order.combineAll([byAge, byName]);
    expect(O({ name: "Alice", age: 30 }, { name: "Bob", age: 30 })).toBe(-1);
  });
});

describe("sort()", () => {
  it("returns a new sorted array without mutating the input", () => {
    const byAge = Order.mapInput(Order.number, (u: User) => u.age);
    const byName = Order.mapInput(Order.string, (u: User) => u.name);
    const sorted = Order.sort(Order.combine(byAge, byName))(users);

    expect(sorted.map((u) => `${u.name}:${u.age}`)).toEqual(["Bob:25", "Alice:30", "Carol:30"]);
    expect(users[0].name).toBe("Carol"); // original untouched
  });

  it("composes with pipe", () => {
    const result = pipe([3, 1, 2], Order.sort(Order.number));
    expect(result).toEqual([1, 2, 3]);
  });
});

describe("array()", () => {
  it("compares lexicographically with shorter-prefix-first", () => {
    const O = Order.array(Order.number);
    expect(O([1, 2], [1, 3])).toBe(-1);
    expect(O([1], [1, 2])).toBe(-1);
    expect(O([1, 2], [1, 2])).toBe(0);
  });
});

describe("comparison helpers", () => {
  it("lessThan / greaterThan and their inclusive variants", () => {
    expect(Order.lessThan(Order.number)(1, 2)).toBe(true);
    expect(Order.lessThanOrEqualTo(Order.number)(2, 2)).toBe(true);
    expect(Order.greaterThan(Order.number)(3, 2)).toBe(true);
    expect(Order.greaterThanOrEqualTo(Order.number)(2, 2)).toBe(true);
  });

  it("min / max favor self on ties", () => {
    expect(Order.min(Order.number)(1, 2)).toBe(1);
    expect(Order.max(Order.number)(1, 2)).toBe(2);
  });

  it("clamp constrains into range", () => {
    const clampNum = Order.clamp(Order.number);
    expect(clampNum(5, { minimum: 0, maximum: 10 })).toBe(5);
    expect(clampNum(-3, { minimum: 0, maximum: 10 })).toBe(0);
    expect(clampNum(42, { minimum: 0, maximum: 10 })).toBe(10);
  });

  it("between tests inclusive membership", () => {
    const inRange = Order.between(Order.number);
    expect(inRange(5, { minimum: 0, maximum: 10 })).toBe(true);
    expect(inRange(0, { minimum: 0, maximum: 10 })).toBe(true);
    expect(inRange(11, { minimum: 0, maximum: 10 })).toBe(false);
  });
});

describe("types", () => {
  it("Order.Order<A> and Ordering are exported", () => {
    const o: Order.Order<number> = Order.number;
    expectTypeOf(o(1, 2)).toEqualTypeOf<Order.Ordering>();
  });
});
