import { describe, it, expect } from "vitest";
import { right, left, isRight, isLeft, fromPredicate, all } from "../either";
import { pipe } from "../functions";

describe("Either.fromPredicate", () => {
  it("data-first returns Right when the predicate holds, Left otherwise", () => {
    expect(
      fromPredicate(
        4,
        (n) => n > 0,
        () => "not positive"
      )
    ).toEqual(right(4));
    expect(
      fromPredicate(
        -1,
        (n) => n > 0,
        () => "not positive"
      )
    ).toEqual(left("not positive"));
  });

  it("data-last composes with pipe", () => {
    const positive = fromPredicate(
      (n: number) => n > 0,
      () => "not positive"
    );
    expect(pipe(4, positive)).toEqual(right(4));
    expect(pipe(-1, positive)).toEqual(left("not positive"));
  });

  it("passes the value to the onFalse factory", () => {
    const result = fromPredicate(
      -5,
      (n) => n > 0,
      (n) => `bad: ${n}`
    );
    expect(result).toEqual(left("bad: -5"));
  });
});

describe("Either.all", () => {
  it("returns Right of all values when every element is Right", () => {
    expect(all([right(1), right(2), right(3)])).toEqual(right([1, 2, 3]));
  });

  it("returns the first Left encountered (short-circuit)", () => {
    const result = all<string, number>([right(1), left("boom"), left("later")]);
    expect(isLeft(result)).toBe(true);
    expect(result).toEqual(left("boom"));
  });

  it("returns Right([]) for an empty iterable", () => {
    const result = all<string, number>([]);
    expect(isRight(result)).toBe(true);
    expect(result).toEqual(right([]));
  });
});
