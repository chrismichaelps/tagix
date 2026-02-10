import { describe, it, expect, vi } from "vitest";
import {
  taggedEnum,
  createStore,
  createAction,
  createAsyncAction,
  deriveStore,
  DerivedStore,
} from "../../index";

const CartState = taggedEnum({
  Empty: {},
  HasItems: { items: [] as { name: string; price: number }[] },
});

const DiscountState = taggedEnum({
  None: { rate: 0 },
  Active: { rate: 0, code: "" },
});

const UserState = taggedEnum({
  Anonymous: {},
  LoggedIn: { name: "", email: "" },
});

type CartStateType = typeof CartState.State;
type DiscountStateType = typeof DiscountState.State;
type UserStateType = typeof UserState.State;

describe("deriveStore()", () => {
  describe("creation & initial value", () => {
    it("should derive initial state from two source stores", () => {
      const cart = createStore(
        CartState.HasItems({ items: [{ name: "Shoes", price: 100 }] }),
        CartState
      );
      const discount = createStore(DiscountState.None({ rate: 0 }), DiscountState);
      const derived = deriveStore([cart, discount], ([cartState, discountState]) => {
        if (cartState._tag === "HasItems") {
          const subtotal = cartState.items.reduce((sum, i) => sum + i.price, 0);
          const rate = discountState._tag === "Active" ? discountState.rate : 0;
          return { total: subtotal * (1 - rate) };
        }
        return { total: 0 };
      });
      expect(derived.stateValue).toEqual({ total: 100 });
      expect(derived).toBeInstanceOf(DerivedStore);
      expect(derived.destroyed).toBe(false);
    });
    it("should derive initial state from an empty cart", () => {
      const cart = createStore(CartState.Empty({}), CartState);
      const discount = createStore(DiscountState.None({ rate: 0 }), DiscountState);
      const derived = deriveStore([cart, discount], ([cartState]) => ({
        isEmpty: cartState._tag === "Empty",
      }));
      expect(derived.stateValue).toEqual({ isEmpty: true });
    });
  });
  describe("reactive updates", () => {
    it("should auto-update when a source store changes via setState", () => {
      const cart = createStore(
        CartState.HasItems({ items: [{ name: "Hat", price: 25 }] }),
        CartState
      );
      const discount = createStore(DiscountState.None({ rate: 0 }), DiscountState);
      const derived = deriveStore([cart, discount], ([cartState, discountState]) => {
        if (cartState._tag === "HasItems") {
          const subtotal = cartState.items.reduce((sum, i) => sum + i.price, 0);
          const rate = discountState._tag === "Active" ? discountState.rate : 0;
          return { total: subtotal * (1 - rate) };
        }
        return { total: 0 };
      });
      expect(derived.stateValue).toEqual({ total: 25 });
      cart.setState(
        CartState.HasItems({
          items: [
            { name: "Hat", price: 25 },
            { name: "Scarf", price: 15 },
          ],
        })
      );
      expect(derived.stateValue).toEqual({ total: 40 });
    });
    it("should auto-update when a discount is applied", () => {
      const cart = createStore(
        CartState.HasItems({ items: [{ name: "Jacket", price: 200 }] }),
        CartState
      );
      const discount = createStore(DiscountState.None({ rate: 0 }), DiscountState);
      const derived = deriveStore([cart, discount], ([cartState, discountState]) => {
        if (cartState._tag === "HasItems") {
          const subtotal = cartState.items.reduce((sum, i) => sum + i.price, 0);
          const rate = discountState._tag === "Active" ? discountState.rate : 0;
          return { total: subtotal * (1 - rate) };
        }
        return { total: 0 };
      });
      expect(derived.stateValue).toEqual({ total: 200 });
      discount.setState(DiscountState.Active({ rate: 0.2, code: "SAVE20" }));
      expect(derived.stateValue).toEqual({ total: 160 });
    });
    it("should react when either source changes", () => {
      const cart = createStore(
        CartState.HasItems({ items: [{ name: "T-shirt", price: 50 }] }),
        CartState
      );
      const discount = createStore(DiscountState.None({ rate: 0 }), DiscountState);
      const values: number[] = [];
      const derived = deriveStore([cart, discount], ([cartState, discountState]) => {
        if (cartState._tag === "HasItems") {
          const subtotal = cartState.items.reduce((sum, i) => sum + i.price, 0);
          const rate = discountState._tag === "Active" ? discountState.rate : 0;
          return { total: subtotal * (1 - rate) };
        }
        return { total: 0 };
      });
      derived.subscribe((v) => values.push(v.total));
      cart.setState(
        CartState.HasItems({
          items: [
            { name: "T-shirt", price: 50 },
            { name: "Socks", price: 10 },
          ],
        })
      );
      discount.setState(DiscountState.Active({ rate: 0.1, code: "10OFF" }));
      expect(values).toEqual([50, 60, 54]);
    });
  });
  describe("memoization", () => {
    it("should NOT notify subscribers when derived value is unchanged", () => {
      const cart = createStore(
        CartState.HasItems({ items: [{ name: "Pen", price: 5 }] }),
        CartState
      );
      const user = createStore(UserState.Anonymous({}), UserState);
      const callback = vi.fn();
      const derived = deriveStore([cart, user], ([cartState]) => {
        if (cartState._tag === "HasItems") {
          return { count: cartState.items.length };
        }
        return { count: 0 };
      });
      derived.subscribe(callback);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({ count: 1 });
      user.setState(UserState.LoggedIn({ name: "Chris", email: "chris@test.com" }));
      expect(callback).toHaveBeenCalledTimes(1);
    });
    it("should notify when derived value structurally changes", () => {
      const cart = createStore(
        CartState.HasItems({ items: [{ name: "Pen", price: 5 }] }),
        CartState
      );
      const user = createStore(UserState.Anonymous({}), UserState);
      const callback = vi.fn();
      const derived = deriveStore([cart, user], ([cartState, userState]) => ({
        itemCount: cartState._tag === "HasItems" ? cartState.items.length : 0,
        isLoggedIn: userState._tag === "LoggedIn",
      }));
      derived.subscribe(callback);
      expect(callback).toHaveBeenCalledTimes(1);
      user.setState(UserState.LoggedIn({ name: "Michael", email: "michael@test.com" }));
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenLastCalledWith({ itemCount: 1, isLoggedIn: true });
    });
  });
  describe("three source stores", () => {
    it("should support deriving from 3 stores", () => {
      const cart = createStore(
        CartState.HasItems({ items: [{ name: "Book", price: 30 }] }),
        CartState
      );
      const discount = createStore(DiscountState.None({ rate: 0 }), DiscountState);
      const user = createStore(
        UserState.LoggedIn({ name: "Chris", email: "chris@test.com" }),
        UserState
      );
      const summary = deriveStore(
        [cart, discount, user],
        ([cartState, discountState, userState]) => {
          const itemCount = cartState._tag === "HasItems" ? cartState.items.length : 0;
          const discountRate = discountState._tag === "Active" ? discountState.rate : 0;
          const userName = userState._tag === "LoggedIn" ? userState.name : "Guest";
          return {
            itemCount,
            discountRate,
            greeting: `Hello, ${userName}! You have ${itemCount} items.`,
          };
        }
      );
      expect(summary.stateValue).toEqual({
        itemCount: 1,
        discountRate: 0,
        greeting: "Hello, Chris! You have 1 items.",
      });
      user.setState(UserState.Anonymous({}));
      expect(summary.stateValue.greeting).toBe("Hello, Guest! You have 1 items.");
    });
  });
  describe("destroy()", () => {
    it("should stop reacting to source changes after destroy", () => {
      const cart = createStore(
        CartState.HasItems({ items: [{ name: "Item", price: 10 }] }),
        CartState
      );
      const discount = createStore(DiscountState.None({ rate: 0 }), DiscountState);
      const callback = vi.fn();
      const derived = deriveStore([cart, discount], ([cartState]) => ({
        count: cartState._tag === "HasItems" ? cartState.items.length : 0,
      }));
      derived.subscribe(callback);
      expect(callback).toHaveBeenCalledTimes(1);
      derived.destroy();
      expect(derived.destroyed).toBe(true);
      cart.setState(
        CartState.HasItems({
          items: [
            { name: "Item", price: 10 },
            { name: "Item2", price: 20 },
          ],
        })
      );
      expect(callback).toHaveBeenCalledTimes(1);
      expect(derived.stateValue).toEqual({ count: 1 });
    });
    it("should be idempotent (calling destroy twice is safe)", () => {
      const cart = createStore(CartState.Empty({}), CartState);
      const discount = createStore(DiscountState.None({ rate: 0 }), DiscountState);
      const derived = deriveStore([cart, discount], () => ({ ok: true }));
      derived.destroy();
      derived.destroy();
      expect(derived.destroyed).toBe(true);
    });
  });
  describe("custom equality", () => {
    it("should use custom equals function when provided", () => {
      const cart = createStore(
        CartState.HasItems({ items: [{ name: "A", price: 10 }] }),
        CartState
      );
      const discount = createStore(DiscountState.None({ rate: 0 }), DiscountState);
      const callback = vi.fn();
      const derived = deriveStore(
        [cart, discount],
        ([cartState]) => ({
          total:
            cartState._tag === "HasItems"
              ? cartState.items.reduce((sum, i) => sum + i.price, 0)
              : 0,
          lastUpdated: Date.now(),
        }),
        {
          equals: (prev, next) => prev.total === next.total,
        }
      );
      derived.subscribe(callback);
      expect(callback).toHaveBeenCalledTimes(1);
      cart.setState(CartState.HasItems({ items: [{ name: "B", price: 10 }] }));
      expect(callback).toHaveBeenCalledTimes(1);
      cart.setState(CartState.HasItems({ items: [{ name: "B", price: 20 }] }));
      expect(callback).toHaveBeenCalledTimes(2);
    });
  });
  describe("subscriber management", () => {
    it("should call subscriber immediately with current value on subscribe", () => {
      const cart = createStore(
        CartState.HasItems({ items: [{ name: "X", price: 99 }] }),
        CartState
      );
      const discount = createStore(DiscountState.None({ rate: 0 }), DiscountState);
      const derived = deriveStore([cart, discount], ([cartState]) => ({
        hasItems: cartState._tag === "HasItems",
      }));
      const received: boolean[] = [];
      derived.subscribe((v) => received.push(v.hasItems));
      expect(received).toEqual([true]);
    });
    it("should support multiple independent subscribers", () => {
      const cart = createStore(
        CartState.HasItems({ items: [{ name: "Y", price: 50 }] }),
        CartState
      );
      const discount = createStore(DiscountState.None({ rate: 0 }), DiscountState);
      const derived = deriveStore([cart, discount], ([cartState]) => ({
        count: cartState._tag === "HasItems" ? cartState.items.length : 0,
      }));
      const sub1 = vi.fn();
      const sub2 = vi.fn();
      const unsub1 = derived.subscribe(sub1);
      derived.subscribe(sub2);
      expect(sub1).toHaveBeenCalledTimes(1);
      expect(sub2).toHaveBeenCalledTimes(1);
      cart.setState(
        CartState.HasItems({
          items: [
            { name: "Y", price: 50 },
            { name: "Z", price: 30 },
          ],
        })
      );
      expect(sub1).toHaveBeenCalledTimes(2);
      expect(sub2).toHaveBeenCalledTimes(2);
      unsub1();
      cart.setState(
        CartState.HasItems({
          items: [
            { name: "Y", price: 50 },
            { name: "Z", price: 30 },
            { name: "W", price: 20 },
          ],
        })
      );
      expect(sub1).toHaveBeenCalledTimes(2);
      expect(sub2).toHaveBeenCalledTimes(3);
    });
  });
  describe("integration with actions", () => {
    it("should react to state changes triggered by registered actions", () => {
      const cart = createStore(
        CartState.HasItems({ items: [{ name: "Initial", price: 10 }] }),
        CartState
      );
      const discount = createStore(DiscountState.None({ rate: 0 }), DiscountState);

      const addItem = createAction<{ name: string; price: number }, CartStateType>("AddItem")
        .withPayload({ name: "", price: 0 })
        .withState((state, payload) => {
          if (state._tag === "HasItems") {
            return CartState.HasItems({
              items: [...state.items, payload],
            });
          }
          return CartState.HasItems({ items: [payload] });
        });

      cart.register("AddItem", addItem);

      const derived = deriveStore([cart, discount], ([cartState]) => ({
        total:
          cartState._tag === "HasItems" ? cartState.items.reduce((sum, i) => sum + i.price, 0) : 0,
      }));

      expect(derived.stateValue.total).toBe(10);

      cart.dispatch("AddItem", { name: "Extra", price: 15 });

      expect(derived.stateValue.total).toBe(25);
    });

    it("should react to discount action with typed state", () => {
      const cart = createStore(
        CartState.HasItems({ items: [{ name: "Item", price: 100 }] }),
        CartState
      );
      const discount = createStore(DiscountState.None({ rate: 0 }), DiscountState);

      const applyDiscount = createAction<{ rate: number }, DiscountStateType>("ApplyDiscount")
        .withPayload({ rate: 0 })
        .withState((_, payload) => {
          if (payload.rate > 0 && payload.rate <= 1) {
            return DiscountState.Active({ rate: payload.rate, code: "PROMO" });
          }
          return DiscountState.None({ rate: 0 });
        });

      discount.register("ApplyDiscount", applyDiscount);

      const derived = deriveStore([cart, discount], ([cartState, discountState]) => {
        const subtotal =
          cartState._tag === "HasItems" ? cartState.items.reduce((sum, i) => sum + i.price, 0) : 0;
        const rate = discountState._tag === "Active" ? discountState.rate : 0;
        return { subtotal, total: subtotal * (1 - rate) };
      });

      expect(derived.stateValue).toEqual({ subtotal: 100, total: 100 });

      discount.dispatch("ApplyDiscount", { rate: 0.2 });

      expect(derived.stateValue).toEqual({ subtotal: 100, total: 80 });
    });
    it("should react to state changes triggered by registered actions", () => {
      const cart = createStore(
        CartState.HasItems({ items: [{ name: "Initial", price: 10 }] }),
        CartState
      );
      const discount = createStore(DiscountState.None({ rate: 0 }), DiscountState);

      const addItem = createAction<{ name: string; price: number }, CartStateType>("AddItem")
        .withPayload({ name: "", price: 0 })
        .withState((state, payload) => {
          if (state._tag === "HasItems") {
            return CartState.HasItems({
              items: [...state.items, payload],
            });
          }
          return CartState.HasItems({ items: [payload] });
        });

      cart.register("AddItem", addItem);

      const derived = deriveStore([cart, discount], ([cartState]) => ({
        total:
          cartState._tag === "HasItems" ? cartState.items.reduce((sum, i) => sum + i.price, 0) : 0,
      }));

      expect(derived.stateValue.total).toBe(10);
      cart.dispatch("AddItem", { name: "Extra", price: 15 });
      expect(derived.stateValue.total).toBe(25);
    });
    it("should react to async action state changes", async () => {
      const user = createStore(UserState.Anonymous({}), UserState);
      const cart = createStore(CartState.Empty({}), CartState);
      const login = createAsyncAction<
        { email: string },
        UserStateType,
        { name: string; email: string }
      >("Login")
        .state(() => UserState.Anonymous({}))
        .effect(async (payload) => ({
          name: "TestUser",
          email: payload.email,
        }))
        .onSuccess((_, result) => UserState.LoggedIn({ name: result.name, email: result.email }))
        .onError(() => UserState.Anonymous({}));

      user.register("Login", login);
      const derived = deriveStore([user, cart], ([userState]) => ({
        isLoggedIn: userState._tag === "LoggedIn",
        userName: userState._tag === "LoggedIn" ? userState.name : "Guest",
      }));
      expect(derived.stateValue).toEqual({
        isLoggedIn: false,
        userName: "Guest",
      });
      await user.dispatch("Login", { email: "test@test.com" });
      expect(derived.stateValue).toEqual({
        isLoggedIn: true,
        userName: "TestUser",
      });
    });
  });
  describe("edge cases", () => {
    it("should handle primitive derived values", () => {
      const cart = createStore(
        CartState.HasItems({ items: [{ name: "A", price: 10 }] }),
        CartState
      );
      const discount = createStore(DiscountState.None({ rate: 0 }), DiscountState);
      const derived = deriveStore([cart, discount], ([cartState]) =>
        cartState._tag === "HasItems" ? cartState.items.length : 0
      );
      expect(derived.stateValue).toBe(1);
      cart.setState(CartState.Empty({}));
      expect(derived.stateValue).toBe(0);
    });
    it("should handle string derived values", () => {
      const user = createStore(
        UserState.LoggedIn({ name: "Chris", email: "chris@a.com" }),
        UserState
      );
      const cart = createStore(CartState.Empty({}), CartState);
      const derived = deriveStore([user, cart], ([userState]) =>
        userState._tag === "LoggedIn" ? `Welcome, ${userState.name}!` : "Please log in."
      );
      expect(derived.stateValue).toBe("Welcome, Chris!");
    });
    it("should handle rapid sequential changes", () => {
      const cart = createStore(
        CartState.HasItems({ items: [{ name: "Start", price: 1 }] }),
        CartState
      );
      const discount = createStore(DiscountState.None({ rate: 0 }), DiscountState);
      const callback = vi.fn();
      const derived = deriveStore([cart, discount], ([cartState]) => ({
        count: cartState._tag === "HasItems" ? cartState.items.length : 0,
      }));
      derived.subscribe(callback);
      for (let i = 2; i <= 5; i++) {
        const items = Array.from({ length: i }, (_, j) => ({
          name: `Item${j}`,
          price: j,
        }));
        cart.setState(CartState.HasItems({ items }));
      }
      expect(callback).toHaveBeenCalledTimes(5);
      expect(derived.stateValue).toEqual({ count: 5 });
    });
  });
  describe("production scenarios", () => {
    it("should handle deriver that throws an exception", () => {
      const cart = createStore(
        CartState.HasItems({ items: [{ name: "Safe", price: 10 }] }),
        CartState
      );
      const discount = createStore(DiscountState.None({ rate: 0 }), DiscountState);
      let callCount = 0;
      const derived = deriveStore([cart, discount], ([cartState]) => {
        callCount++;
        if (callCount > 1) {
          throw new Error("Deriver crashed");
        }
        return {
          total:
            cartState._tag === "HasItems"
              ? cartState.items.reduce((sum, i) => sum + i.price, 0)
              : 0,
        };
      });
      expect(derived.stateValue).toEqual({ total: 10 });
      cart.setState(CartState.HasItems({ items: [{ name: "Boom", price: 20 }] }));
      let errorThrown = false;
      try {
        const _ = derived.stateValue;
      } catch (e) {
        errorThrown = e instanceof Error && e.message === "Deriver crashed";
      }
      expect(errorThrown).toBe(true);
      expect(derived.stateValue).toEqual({ total: 10 });
    });
    it("should allow subscribing after destroy (no-op subscription)", () => {
      const cart = createStore(CartState.Empty({}), CartState);
      const discount = createStore(DiscountState.None({ rate: 0 }), DiscountState);
      const derived = deriveStore([cart, discount], () => ({ ok: true }));
      derived.destroy();
      const callback = vi.fn();
      const unsub = derived.subscribe(callback);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({ ok: true });
      cart.setState(CartState.HasItems({ items: [{ name: "X", price: 1 }] }));
      expect(callback).toHaveBeenCalledTimes(1);
      unsub();
    });
    it("should support diamond dependency (two derived stores from same sources)", () => {
      const cart = createStore(
        CartState.HasItems({
          items: [
            { name: "A", price: 50 },
            { name: "B", price: 30 },
          ],
        }),
        CartState
      );
      const discount = createStore(DiscountState.None({ rate: 0 }), DiscountState);
      const itemCount = deriveStore([cart, discount], ([cartState]) => ({
        count: cartState._tag === "HasItems" ? cartState.items.length : 0,
      }));
      const totalPrice = deriveStore([cart, discount], ([cartState, discountState]) => {
        if (cartState._tag === "HasItems") {
          const subtotal = cartState.items.reduce((sum, i) => sum + i.price, 0);
          const rate = discountState._tag === "Active" ? discountState.rate : 0;
          return { total: subtotal * (1 - rate) };
        }
        return { total: 0 };
      });
      expect(itemCount.stateValue).toEqual({ count: 2 });
      expect(totalPrice.stateValue).toEqual({ total: 80 });
      cart.setState(
        CartState.HasItems({
          items: [
            { name: "A", price: 50 },
            { name: "B", price: 30 },
            { name: "C", price: 20 },
          ],
        })
      );
      expect(itemCount.stateValue).toEqual({ count: 3 });
      expect(totalPrice.stateValue).toEqual({ total: 100 });
      itemCount.destroy();
      cart.setState(CartState.Empty({}));
      expect(itemCount.stateValue).toEqual({ count: 3 });
      expect(totalPrice.stateValue).toEqual({ total: 0 });
    });
    it("should handle state tag transitions correctly", () => {
      const cart = createStore(CartState.Empty({}), CartState);
      const user = createStore(UserState.Anonymous({}), UserState);
      const transitions: string[] = [];
      const derived = deriveStore([cart, user], ([cartState, userState]) => {
        const label = `${cartState._tag}:${userState._tag}`;
        return { label };
      });
      derived.subscribe((v) => transitions.push(v.label));
      expect(transitions).toEqual(["Empty:Anonymous"]);
      cart.setState(CartState.HasItems({ items: [{ name: "X", price: 1 }] }));
      expect(transitions).toEqual(["Empty:Anonymous", "HasItems:Anonymous"]);
      user.setState(UserState.LoggedIn({ name: "Chris", email: "c@test.com" }));
      expect(transitions).toEqual(["Empty:Anonymous", "HasItems:Anonymous", "HasItems:LoggedIn"]);
      cart.setState(CartState.Empty({}));
      user.setState(UserState.Anonymous({}));
      expect(transitions).toEqual([
        "Empty:Anonymous",
        "HasItems:Anonymous",
        "HasItems:LoggedIn",
        "Empty:LoggedIn",
        "Empty:Anonymous",
      ]);
    });
    it("should handle large item collections efficiently", () => {
      const items = Array.from({ length: 1000 }, (_, i) => ({
        name: `Item-${i}`,
        price: Math.random() * 100,
      }));
      const cart = createStore(CartState.HasItems({ items }), CartState);
      const discount = createStore(
        DiscountState.Active({ rate: 0.15, code: "BULK15" }),
        DiscountState
      );
      const derived = deriveStore([cart, discount], ([cartState, discountState]) => {
        if (cartState._tag === "HasItems") {
          const subtotal = cartState.items.reduce((sum, i) => sum + i.price, 0);
          const rate = discountState._tag === "Active" ? discountState.rate : 0;
          return {
            itemCount: cartState.items.length,
            subtotal,
            total: subtotal * (1 - rate),
            averagePrice: subtotal / cartState.items.length,
          };
        }
        return { itemCount: 0, subtotal: 0, total: 0, averagePrice: 0 };
      });
      expect(derived.stateValue.itemCount).toBe(1000);
      expect(derived.stateValue.total).toBeGreaterThan(0);
      expect(derived.stateValue.total).toBeLessThan(derived.stateValue.subtotal);
    });
    it("should correctly handle unsubscribe-all without affecting derived state", () => {
      const cart = createStore(
        CartState.HasItems({ items: [{ name: "Test", price: 10 }] }),
        CartState
      );
      const discount = createStore(DiscountState.None({ rate: 0 }), DiscountState);
      const derived = deriveStore([cart, discount], ([cartState]) => ({
        count: cartState._tag === "HasItems" ? cartState.items.length : 0,
      }));
      const sub1 = vi.fn();
      const sub2 = vi.fn();
      const sub3 = vi.fn();
      const unsub1 = derived.subscribe(sub1);
      const unsub2 = derived.subscribe(sub2);
      const unsub3 = derived.subscribe(sub3);
      expect(sub1).toHaveBeenCalledTimes(1);
      expect(sub2).toHaveBeenCalledTimes(1);
      expect(sub3).toHaveBeenCalledTimes(1);
      unsub1();
      unsub2();
      unsub3();
      cart.setState(
        CartState.HasItems({
          items: [
            { name: "A", price: 1 },
            { name: "B", price: 2 },
          ],
        })
      );
      expect(sub1).toHaveBeenCalledTimes(1);
      expect(sub2).toHaveBeenCalledTimes(1);
      expect(sub3).toHaveBeenCalledTimes(1);
      expect(derived.stateValue).toEqual({ count: 2 });
    });
    it("should always reflect the latest state across all sources in a single recompute", () => {
      const cart = createStore(
        CartState.HasItems({ items: [{ name: "X", price: 100 }] }),
        CartState
      );
      const discount = createStore(DiscountState.None({ rate: 0 }), DiscountState);
      const snapshots: Array<{ tag: string; rate: number }> = [];
      const derived = deriveStore([cart, discount], ([cartState, discountState]) => {
        const result = {
          tag: cartState._tag,
          rate: discountState._tag === "Active" ? discountState.rate : 0,
        };
        snapshots.push(result);
        return result;
      });
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0]).toEqual({ tag: "HasItems", rate: 0 });
      discount.setState(DiscountState.Active({ rate: 0.25, code: "25OFF" }));
      expect(snapshots).toHaveLength(2);
      expect(snapshots[1]).toEqual({ tag: "HasItems", rate: 0.25 });
    });
    it("should not re-notify when setting source to structurally identical state", () => {
      const cart = createStore(
        CartState.HasItems({ items: [{ name: "Widget", price: 42 }] }),
        CartState
      );
      const discount = createStore(DiscountState.None({ rate: 0 }), DiscountState);
      const callback = vi.fn();
      const derived = deriveStore([cart, discount], ([cartState]) => ({
        total:
          cartState._tag === "HasItems" ? cartState.items.reduce((sum, i) => sum + i.price, 0) : 0,
      }));
      derived.subscribe(callback);
      expect(callback).toHaveBeenCalledTimes(1);
      cart.setState(CartState.HasItems({ items: [{ name: "Widget", price: 42 }] }));
      expect(callback).toHaveBeenCalledTimes(1);
    });
    it("should handle concurrent updates from multiple sources in sequence", () => {
      const cart = createStore(
        CartState.HasItems({ items: [{ name: "Shirt", price: 40 }] }),
        CartState
      );
      const discount = createStore(DiscountState.None({ rate: 0 }), DiscountState);
      const user = createStore(UserState.Anonymous({}), UserState);
      const history: string[] = [];
      const derived = deriveStore(
        [cart, discount, user],
        ([cartState, discountState, userState]) => {
          const items = cartState._tag === "HasItems" ? cartState.items.length : 0;
          const rate = discountState._tag === "Active" ? discountState.rate : 0;
          const name = userState._tag === "LoggedIn" ? userState.name : "anon";
          return `${name}:${items}:${rate}`;
        }
      );
      derived.subscribe((v) => history.push(v));
      user.setState(UserState.LoggedIn({ name: "Michael", email: "m@test.com" }));
      cart.setState(
        CartState.HasItems({
          items: [
            { name: "Shirt", price: 40 },
            { name: "Pants", price: 60 },
          ],
        })
      );
      discount.setState(DiscountState.Active({ rate: 0.1, code: "10OFF" }));
      user.setState(UserState.Anonymous({}));
      expect(history).toEqual([
        "anon:1:0",
        "Michael:1:0",
        "Michael:2:0",
        "Michael:2:0.1",
        "anon:2:0.1",
      ]);
    });
    it("should support computing complex aggregations", () => {
      const cart = createStore(
        CartState.HasItems({
          items: [
            { name: "Laptop", price: 999 },
            { name: "Mouse", price: 29 },
            { name: "Keyboard", price: 79 },
            { name: "Monitor", price: 399 },
          ],
        }),
        CartState
      );
      const discount = createStore(
        DiscountState.Active({ rate: 0.1, code: "TECH10" }),
        DiscountState
      );
      const analytics = deriveStore([cart, discount], ([cartState, discountState]) => {
        if (cartState._tag !== "HasItems") {
          return {
            itemCount: 0,
            subtotal: 0,
            discountAmount: 0,
            total: 0,
            cheapestItem: null as string | null,
            mostExpensiveItem: null as string | null,
          };
        }
        const { items } = cartState;
        const subtotal = items.reduce((sum, i) => sum + i.price, 0);
        const rate = discountState._tag === "Active" ? discountState.rate : 0;
        const discountAmount = subtotal * rate;
        const sorted = [...items].sort((a, b) => a.price - b.price);
        return {
          itemCount: items.length,
          subtotal,
          discountAmount,
          total: subtotal - discountAmount,
          cheapestItem: sorted[0]?.name ?? null,
          mostExpensiveItem: sorted[sorted.length - 1]?.name ?? null,
        };
      });
      expect(analytics.stateValue).toEqual({
        itemCount: 4,
        subtotal: 1506,
        discountAmount: 150.6,
        total: 1355.4,
        cheapestItem: "Mouse",
        mostExpensiveItem: "Laptop",
      });
      discount.setState(DiscountState.None({ rate: 0 }));
      expect(analytics.stateValue.discountAmount).toBe(0);
      expect(analytics.stateValue.total).toBe(1506);
    });
  });
});
