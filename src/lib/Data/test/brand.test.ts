import { describe, it, expect, expectTypeOf } from "vitest";
import { nominal, refined, is, type Brand } from "../brand";
import { isRight, isLeft } from "../either";

type UserId = Brand<string, "UserId">;
type OrderId = Brand<string, "OrderId">;
type Email = Brand<string, "Email">;
type Int = Brand<number, "Int">;

describe("Brand", () => {
  describe("nominal", () => {
    it("constructs a branded value that is still its base type at runtime", () => {
      const UserId = nominal<string, "UserId">();
      const id = UserId("u_123");
      expect(id).toBe("u_123");
      const asString: string = id; // a UserId is assignable to its base
      expect(asString).toBe("u_123");
      expectTypeOf(id).toEqualTypeOf<UserId>();
    });

    it("keeps distinct brands non-assignable (type-level)", () => {
      const UserId = nominal<string, "UserId">();
      const OrderId = nominal<string, "OrderId">();
      const u = UserId("u_1");
      const o = OrderId("o_1");
      expectTypeOf(u).not.toEqualTypeOf(o);
      // @ts-expect-error a UserId must not be assignable to an OrderId
      const bad: OrderId = u;
      void bad;
      void o;
    });
  });

  describe("refined", () => {
    const Email = refined<string, "Email", string>(
      (s) => s.includes("@"),
      (s) => `invalid email: ${s}`
    );

    it("returns Right for valid input", () => {
      const e = Email("a@b.com");
      expect(isRight(e)).toBe(true);
      if (isRight(e)) {
        expect(e.right).toBe("a@b.com");
        expectTypeOf(e.right).toEqualTypeOf<Email>();
      }
    });

    it("returns Left(onFailure) for invalid input", () => {
      const e = Email("nope");
      expect(isLeft(e)).toBe(true);
      if (isLeft(e)) {
        expect(e.left).toBe("invalid email: nope");
      }
    });
  });

  describe("is", () => {
    it("narrows the base type to the brand when the predicate holds", () => {
      const isInt = is<number, "Int">(Number.isInteger);
      const n: number = 5;
      if (isInt(n)) {
        expectTypeOf(n).toEqualTypeOf<Int>();
        expect(n).toBe(5);
      } else {
        throw new Error("expected an integer");
      }
      expect(isInt(5.5)).toBe(false);
    });
  });

  describe("composition", () => {
    it("a value branded with two names is assignable to either brand (type-level)", () => {
      type PositiveInt = Brand<number, "Int"> & Brand<number, "Positive">;
      const x = 5 as PositiveInt;
      const asInt: Int = x; // PositiveInt is also an Int
      const asPositive: Brand<number, "Positive"> = x;
      expect(asInt).toBe(5);
      expect(asPositive).toBe(5);
    });
  });
});
