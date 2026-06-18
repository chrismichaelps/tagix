import { describe, it, expect } from "vitest";
import {
  some,
  none,
  isSome,
  isNone,
  map,
  flatMap,
  filter,
  tap,
  getOrElse,
  orElse,
} from "../option";
import { pipe } from "../functions";

describe("Option dual (data-first + data-last) combinators", () => {
  describe("map", () => {
    it("data-first transforms Some, passes through None", () => {
      expect(map(some(2), (n) => n * 3)).toEqual(some(6));
      expect(isNone(map(none<number>(), (n) => n * 3))).toBe(true);
    });

    it("data-last composes with pipe", () => {
      const result = pipe(
        some(2),
        map((n: number) => n * 3),
        map((n: number) => n + 1)
      );
      expect(result).toEqual(some(7));
    });
  });

  describe("flatMap", () => {
    it("data-first chains Option-returning functions", () => {
      expect(flatMap(some(2), (n) => some(n * 2))).toEqual(some(4));
      expect(isNone(flatMap(some(2), () => none<number>()))).toBe(true);
    });

    it("data-last composes with pipe", () => {
      const half = (n: number) => (n % 2 === 0 ? some(n / 2) : none<number>());
      expect(pipe(some(8), flatMap(half))).toEqual(some(4));
      expect(isNone(pipe(some(5), flatMap(half)))).toBe(true);
    });
  });

  describe("filter", () => {
    it("data-first keeps matching, drops non-matching", () => {
      expect(filter(some(4), (n) => n > 0)).toEqual(some(4));
      expect(isNone(filter(some(-1), (n) => n > 0))).toBe(true);
    });

    it("data-last composes with pipe", () => {
      expect(
        pipe(
          some(4),
          filter((n: number) => n > 0)
        )
      ).toEqual(some(4));
      expect(
        isNone(
          pipe(
            some(-1),
            filter((n: number) => n > 0)
          )
        )
      ).toBe(true);
    });
  });

  describe("tap", () => {
    it("runs the side effect on Some only and returns the option unchanged", () => {
      const seen: number[] = [];
      const out = pipe(
        some(5),
        tap((n: number) => seen.push(n))
      );
      expect(out).toEqual(some(5));
      expect(seen).toEqual([5]);

      pipe(
        none<number>(),
        tap((n: number) => seen.push(n))
      );
      expect(seen).toEqual([5]); // not called for None
    });
  });

  describe("getOrElse", () => {
    it("data-first returns value or fallback", () => {
      expect(getOrElse(some(1), () => 0)).toBe(1);
      expect(getOrElse(none<number>(), () => 0)).toBe(0);
    });

    it("data-last composes with pipe", () => {
      expect(
        pipe(
          some(1),
          getOrElse(() => 0)
        )
      ).toBe(1);
      expect(
        pipe(
          none<number>(),
          getOrElse(() => 99)
        )
      ).toBe(99);
    });
  });

  describe("orElse", () => {
    it("data-first falls back to the alternative option", () => {
      expect(orElse(some(1), () => some(2))).toEqual(some(1));
      expect(orElse(none<number>(), () => some(2))).toEqual(some(2));
    });

    it("data-last composes with pipe", () => {
      expect(
        pipe(
          none<number>(),
          orElse(() => some(7))
        )
      ).toEqual(some(7));
      expect(
        isSome(
          pipe(
            some(1),
            orElse(() => some(7))
          )
        )
      ).toBe(true);
    });
  });
});
