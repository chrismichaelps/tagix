import { describe, it, expect } from "vitest";
import {
  taggedEnum,
  createStore,
  createAction,
  createAsyncAction,
  deriveStore,
  fork,
} from "../../index";
import { createActionGroup } from "../group";

const UserState = taggedEnum({
  LoggedOut: {},
  LoggedIn: { name: "", email: "" },
});

const CartState = taggedEnum({
  Empty: {},
  HasItems: { items: [] as { name: string; price: number; quantity: number }[] },
  Pending: { items: [] as { name: string; price: number }[] },
});

const OrderState = taggedEnum({
  Draft: {},
  Submitted: { orderId: "", total: 0 },
  Shipped: { orderId: "", tracking: "" },
});

type UserStateType = typeof UserState.State;
type CartStateType = typeof CartState.State;
type OrderStateType = typeof OrderState.State;

function assertLoggedIn(
  state: UserStateType
): asserts state is typeof state & { _tag: "LoggedIn" } {
  expect(state._tag).toBe("LoggedIn");
}

function assertLoggedOut(
  state: UserStateType
): asserts state is typeof state & { _tag: "LoggedOut" } {
  expect(state._tag).toBe("LoggedOut");
}

function assertHasItems(
  state: CartStateType
): asserts state is typeof state & { _tag: "HasItems" } {
  expect(state._tag).toBe("HasItems");
}

function assertSubmitted(
  state: OrderStateType
): asserts state is typeof state & { _tag: "Submitted" } {
  expect(state._tag).toBe("Submitted");
}

describe("createActionGroup()", () => {
  describe("namespace prefixing", () => {
    it("should prefix action types with namespace", () => {
      const login = createAction<{ username: string }, UserStateType>("Login")
        .withPayload({ username: "" })
        .withState((_, payload) => UserState.LoggedIn({ name: payload.username, email: "" }));

      const UserActions = createActionGroup("User", { login });

      expect(UserActions.login.type).toBe("tagix/action/User/Login");
    });

    it("should preserve action payload type", () => {
      const updateProfile = createAction<{ name: string; email: string }, UserStateType>(
        "UpdateProfile"
      )
        .withPayload({ name: "", email: "" })
        .withState((state, payload) => UserState.LoggedIn({ ...state, ...payload }));

      const UserActions = createActionGroup("User", { updateProfile });

      expect(UserActions.updateProfile.type).toBe("tagix/action/User/UpdateProfile");
      expect(UserActions.updateProfile.payload).toEqual({ name: "", email: "" });
    });

    it("should handle namespace with trailing slash", () => {
      const logout = createAction("Logout").withState(() => UserState.LoggedOut({}));

      const UserActions = createActionGroup("User/", { logout });

      expect(UserActions.logout.type).toBe("tagix/action/User/Logout");
    });

    it("should handle deeply nested namespace", () => {
      const addItem = createAction<{ name: string; price: number }, CartStateType>("AddItem")
        .withPayload({ name: "", price: 0 })
        .withState((state, payload) => {
          if (state._tag === "HasItems") {
            return CartState.HasItems({ items: [...state.items, { ...payload, quantity: 1 }] });
          }
          return CartState.HasItems({ items: [{ ...payload, quantity: 1 }] });
        });

      const CartActions = createActionGroup("Shop/Cart/Item", { addItem });

      expect(CartActions.addItem.type).toBe("tagix/action/Shop/Cart/Item/AddItem");
    });
  });

  describe("async actions", () => {
    it("should prefix async action types", () => {
      const fetchUser = createAsyncAction<{ id: string }, UserStateType, { name: string }>(
        "FetchUser"
      )
        .state((s) => s)
        .effect(async (payload) => ({ name: `User${payload.id}` }))
        .onSuccess((_, result) => UserState.LoggedIn({ name: result.name, email: "" }))
        .onError(() => UserState.LoggedOut({}));

      const UserActions = createActionGroup("User", { fetchUser });

      expect(UserActions.fetchUser.type).toBe("tagix/action/User/FetchUser");
    });

    it("should preserve async action structure", () => {
      const login = createAsyncAction<{ username: string }, UserStateType, { token: string }>(
        "Login"
      )
        .state((s) => s)
        .effect(async (payload) => ({ token: `token-${payload.username}` }))
        .onSuccess((state) => {
          const username = state._tag === "LoggedIn" ? state.name : "unknown";
          return UserState.LoggedIn({ name: username, email: "" });
        })
        .onError(() => UserState.LoggedOut({}));

      const UserActions = createActionGroup("Auth", { login });

      expect(UserActions.login.type).toBe("tagix/action/Auth/Login");
      expect(typeof UserActions.login.effect).toBe("function");
      expect(typeof UserActions.login.onSuccess).toBe("function");
    });
  });

  describe("multiple actions", () => {
    it("should group multiple actions", () => {
      const login = createAction<{ username: string }, UserStateType>("Login")
        .withPayload({ username: "" })
        .withState((_, payload) => UserState.LoggedIn({ name: payload.username, email: "" }));

      const logout = createAction("Logout").withState(() => UserState.LoggedOut({}));

      const updateEmail = createAction<{ email: string }, UserStateType>("UpdateEmail")
        .withPayload({ email: "" })
        .withState((state, payload) => {
          if (state._tag === "LoggedIn") {
            return UserState.LoggedIn({ ...state, email: payload.email });
          }
          return state;
        });

      const UserActions = createActionGroup("User", { login, logout, updateEmail });

      expect(UserActions.login.type).toBe("tagix/action/User/Login");
      expect(UserActions.logout.type).toBe("tagix/action/User/Logout");
      expect(UserActions.updateEmail.type).toBe("tagix/action/User/UpdateEmail");
    });

    it("should preserve action handlers", () => {
      const addItem = createAction<{ name: string; price: number }, CartStateType>("AddItem")
        .withPayload({ name: "", price: 0 })
        .withState((state, payload) => {
          if (state._tag === "HasItems") {
            return CartState.HasItems({ items: [...state.items, { ...payload, quantity: 1 }] });
          }
          return CartState.HasItems({ items: [{ ...payload, quantity: 1 }] });
        });

      const CartActions = createActionGroup("Cart", { addItem });

      expect(typeof CartActions.addItem.handler).toBe("function");
    });
  });
});

describe("store.registerGroup()", () => {
  it("should register all actions from a group", () => {
    const store = createStore(UserState.LoggedOut({}), UserState);

    const login = createAction<{ username: string }, UserStateType>("Login")
      .withPayload({ username: "" })
      .withState((_, payload) => UserState.LoggedIn({ name: payload.username, email: "" }));

    const logout = createAction("Logout").withState(() => UserState.LoggedOut({}));

    const UserActions = createActionGroup("User", { login, logout });

    store.registerGroup(UserActions);

    expect(store.registeredActions).toContain("tagix/action/User/Login");
    expect(store.registeredActions).toContain("tagix/action/User/Logout");
  });

  it("should dispatch action from group using action object", () => {
    const store = createStore(UserState.LoggedOut({}), UserState);

    const login = createAction<{ username: string }, UserStateType>("Login")
      .withPayload({ username: "chris" })
      .withState((_, payload) => UserState.LoggedIn({ name: payload.username, email: "" }));

    const UserActions = createActionGroup("User", { login });

    store.registerGroup(UserActions);

    store.dispatch(UserActions.login, { username: "chris" });

    assertLoggedIn(store.stateValue);
    expect(store.stateValue.name).toBe("chris");
  });

  it("should dispatch async action from group", async () => {
    const store = createStore(UserState.LoggedOut({}), UserState);

    const login = createAsyncAction<{ username: string }, UserStateType, { username: string }>(
      "Login"
    )
      .state((s) => s)
      .effect(async (payload) => ({ username: payload.username }))
      .onSuccess((_, result) => UserState.LoggedIn({ name: result.username, email: "" }))
      .onError(() => UserState.LoggedOut({}));

    const AuthActions = createActionGroup("Auth", { login });

    store.registerGroup(AuthActions);

    await store.dispatch(AuthActions.login, { username: "testuser" });

    assertLoggedIn(store.stateValue);
  });
});

describe("dispatch with action group", () => {
  it("should dispatch using string with namespace prefix", () => {
    const store = createStore(UserState.LoggedOut({}), UserState);

    const login = createAction<{ username: string }, UserStateType>("Login")
      .withPayload({ username: "" })
      .withState((_, payload) => UserState.LoggedIn({ name: payload.username, email: "" }));

    const UserActions = createActionGroup("User", { login });

    store.registerGroup(UserActions);

    store.dispatch("User/Login", { username: "michael" });

    assertLoggedIn(store.stateValue);
    expect(store.stateValue.name).toBe("michael");
  });

  it("should throw error for unregistered prefixed action", () => {
    const store = createStore(UserState.LoggedOut({}), UserState);

    expect(() => {
      store.dispatch("User/Unknown", {});
    }).toThrow();
  });
});

describe("real-world scenarios", () => {
  describe("multiple groups in one store", () => {
    it("should handle User and Cart groups in same store", () => {
      const UserCartState = taggedEnum({
        LoggedOut: {},
        LoggedIn: { name: "", email: "" },
        Empty: {},
        HasItems: { items: [] as { name: string; price: number; quantity: number }[] },
      });
      type UserCartStateType = typeof UserCartState.State;

      const store = createStore(UserCartState.LoggedOut({}), UserCartState);

      const login = createAction<{ username: string }, UserCartStateType>("Login")
        .withPayload({ username: "" })
        .withState((_, payload) => UserCartState.LoggedIn({ name: payload.username, email: "" }));

      const logout = createAction("Logout").withState(() => UserCartState.LoggedOut({}));

      const addItem = createAction<{ name: string; price: number }, UserCartStateType>("AddItem")
        .withPayload({ name: "", price: 0 })
        .withState((state, payload) => {
          if (state._tag === "HasItems") {
            return UserCartState.HasItems({ items: [...state.items, { ...payload, quantity: 1 }] });
          }
          return UserCartState.HasItems({ items: [{ ...payload, quantity: 1 }] });
        });

      const clearCart = createAction("ClearCart").withState(() => UserCartState.Empty({}));

      const UserActions = createActionGroup("User", { login, logout });
      const CartActions = createActionGroup("Cart", { addItem, clearCart });

      store.registerGroup(UserActions);
      store.registerGroup(CartActions);

      expect(store.registeredActions).toContain("tagix/action/User/Login");
      expect(store.registeredActions).toContain("tagix/action/User/Logout");
      expect(store.registeredActions).toContain("tagix/action/Cart/AddItem");
      expect(store.registeredActions).toContain("tagix/action/Cart/ClearCart");

      store.dispatch(UserActions.login, { username: "shopper" });
      store.dispatch(CartActions.addItem, { name: "Widget", price: 29.99 });

      expect(store.stateValue._tag).toBe("HasItems");
      expect((store.stateValue as any).items).toHaveLength(1);
    });

    it("should dispatch actions from different groups independently", () => {
      const store = createStore(CartState.Empty({}), CartState);

      const addItem = createAction<{ name: string; price: number }, CartStateType>("AddItem")
        .withPayload({ name: "", price: 0 })
        .withState((state, payload) => {
          if (state._tag === "HasItems") {
            return CartState.HasItems({ items: [...state.items, { ...payload, quantity: 1 }] });
          }
          return CartState.HasItems({ items: [{ ...payload, quantity: 1 }] });
        });

      const CartActions = createActionGroup("Cart", { addItem });
      store.registerGroup(CartActions);

      store.dispatch(CartActions.addItem, { name: "Item1", price: 10 });
      expect(store.stateValue._tag).toBe("HasItems");

      store.dispatch("Cart/AddItem", { name: "Item2", price: 20 });
      expect(store.stateValue._tag).toBe("HasItems");
      expect((store.stateValue as any).items).toHaveLength(2);
    });
  });

  describe("cross-store action groups", () => {
    it("should allow same group name in different stores", () => {
      const userStore = createStore(UserState.LoggedOut({}), UserState);
      const cartStore = createStore(CartState.Empty({}), CartState);

      const login = createAction<{ username: string }, UserStateType>("Login")
        .withPayload({ username: "" })
        .withState((_, payload) => UserState.LoggedIn({ name: payload.username, email: "" }));

      const addItem = createAction<{ name: string; price: number }, CartStateType>("AddItem")
        .withPayload({ name: "", price: 0 })
        .withState((state, payload) => {
          if (state._tag === "HasItems") {
            return CartState.HasItems({ items: [...state.items, { ...payload, quantity: 1 }] });
          }
          return CartState.HasItems({ items: [{ ...payload, quantity: 1 }] });
        });

      const SharedActions = createActionGroup("Shared", { login, addItem });

      userStore.registerGroup(SharedActions);
      cartStore.registerGroup(SharedActions);

      expect(userStore.registeredActions).toContain("tagix/action/Shared/Login");
      expect(cartStore.registeredActions).toContain("tagix/action/Shared/AddItem");

      userStore.dispatch("Shared/Login", { username: "user" });
      cartStore.dispatch("Shared/AddItem", { name: "Product", price: 100 });

      assertLoggedIn(userStore.stateValue);
      assertHasItems(cartStore.stateValue);
    });
  });

  describe("action groups with derived stores", () => {
    it("should react to grouped actions in derived stores", () => {
      const store = createStore(UserState.LoggedOut({}), UserState);

      const login = createAction<{ username: string }, UserStateType>("Login")
        .withPayload({ username: "" })
        .withState((_, payload) => UserState.LoggedIn({ name: payload.username, email: "" }));

      const logout = createAction("Logout").withState(() => UserState.LoggedOut({}));

      const updateEmail = createAction<{ email: string }, UserStateType>("UpdateEmail")
        .withPayload({ email: "" })
        .withState((state, payload) => {
          if (state._tag === "LoggedIn") {
            return UserState.LoggedIn({ ...state, email: payload.email });
          }
          return state;
        });

      const UserActions = createActionGroup("User", { login, logout, updateEmail });
      store.registerGroup(UserActions);

      const isLoggedIn = deriveStore([store], ([userState]) => userState._tag === "LoggedIn");

      expect(isLoggedIn.stateValue).toBe(false);

      store.dispatch(UserActions.login, { username: "user" });
      expect(isLoggedIn.stateValue).toBe(true);

      store.dispatch(UserActions.logout);
      expect(isLoggedIn.stateValue).toBe(false);
    });

    it("should derive cart total from grouped add/remove actions", () => {
      const store = createStore(CartState.Empty({}), CartState);

      const addItem = createAction<{ name: string; price: number }, CartStateType>("AddItem")
        .withPayload({ name: "", price: 0 })
        .withState((state, payload) => {
          if (state._tag === "HasItems") {
            return CartState.HasItems({ items: [...state.items, { ...payload, quantity: 1 }] });
          }
          return CartState.HasItems({ items: [{ ...payload, quantity: 1 }] });
        });

      const removeItem = createAction<{ name: string }, CartStateType>("RemoveItem")
        .withPayload({ name: "" })
        .withState((state, payload) => {
          if (state._tag === "HasItems") {
            const filtered = state.items.filter((i) => i.name !== payload.name);
            if (filtered.length === 0) {
              return CartState.Empty({});
            }
            return CartState.HasItems({ items: filtered });
          }
          return state;
        });

      const CartActions = createActionGroup("Cart", { addItem, removeItem });
      store.registerGroup(CartActions);

      const cartTotal = deriveStore([store], ([cartState]) =>
        cartState._tag === "HasItems"
          ? cartState.items.reduce((sum, i) => sum + i.price * i.quantity, 0)
          : 0
      );

      expect(cartTotal.stateValue).toBe(0);

      store.dispatch(CartActions.addItem, { name: "Book", price: 30 });
      expect(cartTotal.stateValue).toBe(30);

      store.dispatch(CartActions.addItem, { name: "Mouse", price: 20 });
      expect(cartTotal.stateValue).toBe(50);

      store.dispatch(CartActions.removeItem, { name: "Book" });
      expect(cartTotal.stateValue).toBe(20);
    });
  });

  describe("action groups with fork/context", () => {
    it("should isolate grouped actions in forked stores", () => {
      const mainStore = createStore(UserState.LoggedOut({}), UserState);

      const login = createAction<{ username: string }, UserStateType>("Login")
        .withPayload({ username: "" })
        .withState((_, payload) => UserState.LoggedIn({ name: payload.username, email: "" }));

      const logout = createAction("Logout").withState(() => UserState.LoggedOut({}));

      const UserActions = createActionGroup("User", { login, logout });
      mainStore.registerGroup(UserActions);

      const forkedStore = fork(mainStore);

      expect(mainStore.stateValue._tag).toBe("LoggedOut");
      expect(forkedStore.stateValue._tag).toBe("LoggedOut");

      forkedStore.dispatch(UserActions.login, { username: "temp" });

      assertLoggedIn(forkedStore.stateValue);
      expect(forkedStore.stateValue.name).toBe("temp");
      expect(mainStore.stateValue._tag).toBe("LoggedOut");
    });
  });

  describe("complex async workflows", () => {
    it("should handle checkout flow with async action groups", async () => {
      const CartState2 = taggedEnum({
        Empty: {},
        HasItems: { items: [] as { name: string; price: number; quantity: number }[] },
        Pending: { items: [] as { name: string; price: number }[] },
        Submitted: { orderId: "", total: 0 },
      });
      type CartStateType2 = typeof CartState2.State;

      const store = createStore(CartState2.Empty({}), CartState2);

      const addItem = createAction<{ name: string; price: number }, CartStateType2>("AddItem")
        .withPayload({ name: "", price: 0 })
        .withState((state, payload) => {
          if (state._tag === "HasItems") {
            return CartState2.HasItems({ items: [...state.items, { ...payload, quantity: 1 }] });
          }
          return CartState2.HasItems({ items: [{ ...payload, quantity: 1 }] });
        });

      const submitOrder = createAsyncAction<{}, CartStateType2, { orderId: string }>("SubmitOrder")
        .state((s) => (s._tag === "HasItems" ? CartState2.Pending({ items: s.items }) : s))
        .effect(async () => {
          await new Promise((r) => setTimeout(r, 10));
          return { orderId: `ORD-${Date.now()}` };
        })
        .onSuccess((_, result) => {
          const pending = store.stateValue as Extract<typeof store.stateValue, { _tag: "Pending" }>;
          if (pending._tag === "Pending") {
            const total = pending.items.reduce((sum, i) => sum + i.price, 0);
            return CartState2.Submitted({ orderId: result.orderId, total });
          }
          return pending as any;
        })
        .onError(() => CartState2.Empty({}));

      const CartActions = createActionGroup("Cart", { addItem, submitOrder });
      store.registerGroup(CartActions);

      store.dispatch(CartActions.addItem, { name: "Laptop", price: 999 });
      store.dispatch(CartActions.addItem, { name: "Mouse", price: 29 });

      expect(store.stateValue._tag).toBe("HasItems");
      expect((store.stateValue as any).items).toHaveLength(2);

      await store.dispatch(CartActions.submitOrder, {});

      expect(store.stateValue._tag).toBe("Submitted");
      const orderState = store.stateValue as Extract<
        typeof store.stateValue,
        { _tag: "Submitted" }
      >;
      expect(orderState.total).toBe(1028);
      expect(orderState.orderId).toMatch(/^ORD-\d+$/);
    });

    it("should handle retry logic with grouped async actions", async () => {
      const store = createStore(UserState.LoggedOut({}), UserState);
      let attemptCount = 0;

      const fetchWithRetry = createAsyncAction<
        { shouldFail: boolean },
        UserStateType,
        { data: string }
      >("FetchWithRetry")
        .state((s) => s)
        .effect(async (payload) => {
          attemptCount++;
          if (payload.shouldFail && attemptCount < 3) {
            throw new Error("Temporary failure");
          }
          return { data: "Success" };
        })
        .onSuccess((_, result) => UserState.LoggedIn({ name: result.data, email: "test@test.com" }))
        .onError(() => UserState.LoggedOut({}));

      const UserActions = createActionGroup("User", { fetchWithRetry });
      store.registerGroup(UserActions);

      attemptCount = 0;
      await store.dispatch(UserActions.fetchWithRetry, { shouldFail: true });

      expect(attemptCount).toBe(3);
      assertLoggedIn(store.stateValue);
    });
  });

  describe("state transitions with groups", () => {
    it("should handle complex state machine transitions", () => {
      const store = createStore(OrderState.Draft({}), OrderState);

      const submit = createAction<{ total: number }, OrderStateType>("Submit")
        .withPayload({ total: 0 })
        .withState((_, payload) =>
          OrderState.Submitted({ orderId: `ORD-${Date.now()}`, total: payload.total })
        );

      const ship = createAction<{ tracking: string }, OrderStateType>("Ship")
        .withPayload({ tracking: "" })
        .withState((state, payload) => {
          if (state._tag === "Submitted") {
            return OrderState.Shipped({ orderId: state.orderId, tracking: payload.tracking });
          }
          return state;
        });

      const cancel = createAction("Cancel").withState(() => OrderState.Draft({}));

      const OrderActions = createActionGroup("Order", { submit, ship, cancel });
      store.registerGroup(OrderActions);

      expect(store.stateValue._tag).toBe("Draft");

      store.dispatch(OrderActions.submit, { total: 150 });
      assertSubmitted(store.stateValue);
      expect(store.stateValue.total).toBe(150);

      store.dispatch(OrderActions.ship, { tracking: "TRK-12345" });
      expect(store.stateValue._tag).toBe("Shipped");

      store.dispatch(OrderActions.cancel);
      expect(store.stateValue._tag).toBe("Draft");
    });
  });

  describe("payload handling edge cases", () => {
    it("should handle optional payload properties", () => {
      const store = createStore(UserState.LoggedOut({}), UserState);

      const login = createAction<{ username: string }, UserStateType>("Login")
        .withPayload({ username: "" })
        .withState((_, payload) => UserState.LoggedIn({ name: payload.username, email: "" }));

      const updateProfile = createAction<{ name?: string; email?: string }, UserStateType>(
        "UpdateProfile"
      )
        .withPayload({ name: "", email: "" })
        .withState((state, payload) => {
          if (state._tag === "LoggedIn") {
            return UserState.LoggedIn({
              name: payload.name ?? state.name,
              email: payload.email ?? state.email,
            });
          }
          return state;
        });

      const UserActions = createActionGroup("User", { login, updateProfile });
      store.registerGroup(UserActions);

      store.dispatch(UserActions.login, { username: "user" });
      store.dispatch(UserActions.updateProfile, { email: "new@test.com" });

      assertLoggedIn(store.stateValue);
      expect(store.stateValue.name).toBe("user");
      expect(store.stateValue.email).toBe("new@test.com");
    });

    it("should handle array payloads", () => {
      const store = createStore(CartState.Empty({}), CartState);

      const setItems = createAction<{ name: string; price: number }[], CartStateType>("SetItems")
        .withPayload([])
        .withState((_, items) =>
          items.length === 0
            ? CartState.Empty({})
            : CartState.HasItems({ items: items.map((i) => ({ ...i, quantity: 1 })) })
        );

      const CartActions = createActionGroup("Cart", { setItems });
      store.registerGroup(CartActions);

      store.dispatch(CartActions.setItems, [
        { name: "Item1", price: 10 },
        { name: "Item2", price: 20 },
        { name: "Item3", price: 30 },
      ]);

      assertHasItems(store.stateValue);
      expect(store.stateValue.items).toHaveLength(3);
      expect(store.stateValue.items.map((i) => i.name)).toEqual(["Item1", "Item2", "Item3"]);
    });
  });

  describe("error handling", () => {
    it("should handle async action errors gracefully", async () => {
      const store = createStore(UserState.LoggedOut({}), UserState);

      const login = createAsyncAction<{ shouldFail: boolean }, UserStateType, { token: string }>(
        "Login"
      )
        .state((s) => s)
        .effect(async (payload) => {
          if (payload.shouldFail) {
            throw new Error("Login failed");
          }
          return { token: "valid-token" };
        })
        .onSuccess((_, result) => UserState.LoggedIn({ name: "user", email: "user@test.com" }))
        .onError(() => UserState.LoggedOut({}));

      const UserActions = createActionGroup("Auth", { login });
      store.registerGroup(UserActions);

      await store.dispatch(UserActions.login, { shouldFail: true });
      assertLoggedOut(store.stateValue);

      await store.dispatch(UserActions.login, { shouldFail: false });
      assertLoggedIn(store.stateValue);
    });

    it("should handle invalid payload gracefully", () => {
      const store = createStore(UserState.LoggedOut({}), UserState);

      const login = createAction<{ username: string }, UserStateType>("Login")
        .withPayload({ username: "" })
        .withState((_, payload) => {
          if (!payload.username) {
            throw new Error("Username required");
          }
          return UserState.LoggedIn({ name: payload.username, email: "" });
        });

      const UserActions = createActionGroup("User", { login });
      store.registerGroup(UserActions);

      store.dispatch(UserActions.login, { username: "" });

      expect(store.stateValue._tag).toBe("LoggedOut");
      expect(store.lastError instanceof Error).toBe(true);
      expect((store.lastError as Error).message).toBe("Username required");
    });
  });

  describe("concurrent dispatch", () => {
    it("should handle concurrent dispatches from same group", async () => {
      const store = createStore(UserState.LoggedOut({}), UserState);

      const login = createAction<{ username: string }, UserStateType>("Login")
        .withPayload({ username: "" })
        .withState((_, payload) => UserState.LoggedIn({ name: payload.username, email: "" }));

      const updateName = createAction<{ name: string }, UserStateType>("UpdateName")
        .withPayload({ name: "" })
        .withState((state, payload) => {
          if (state._tag === "LoggedIn") {
            return UserState.LoggedIn({ ...state, name: payload.name });
          }
          return state;
        });

      const updateEmail = createAction<{ email: string }, UserStateType>("UpdateEmail")
        .withPayload({ email: "" })
        .withState((state, payload) => {
          if (state._tag === "LoggedIn") {
            return UserState.LoggedIn({ ...state, email: payload.email });
          }
          return state;
        });

      const UserActions = createActionGroup("User", { login, updateName, updateEmail });
      store.registerGroup(UserActions);

      store.dispatch(UserActions.login, { username: "user" });

      await Promise.all([
        store.dispatch(UserActions.updateName, { name: "Name1" }),
        store.dispatch(UserActions.updateEmail, { email: "email1@test.com" }),
        store.dispatch(UserActions.updateName, { name: "Name2" }),
        store.dispatch(UserActions.updateEmail, { email: "email2@test.com" }),
      ]);

      assertLoggedIn(store.stateValue);
      expect(store.stateValue.name).toBe("Name2");
      expect(store.stateValue.email).toBe("email2@test.com");
    });
  });

  describe("action group composition", () => {
    it("should allow registering same group on multiple stores", () => {
      const store1 = createStore(UserState.LoggedOut({}), UserState);
      const store2 = createStore(UserState.LoggedOut({}), UserState);

      const login = createAction<{ username: string }, UserStateType>("Login")
        .withPayload({ username: "" })
        .withState((_, payload) => UserState.LoggedIn({ name: payload.username, email: "" }));

      const logout = createAction("Logout").withState(() => UserState.LoggedOut({}));

      const UserActions = createActionGroup("User", { login, logout });

      store1.registerGroup(UserActions);
      store2.registerGroup(UserActions);

      store1.dispatch(UserActions.login, { username: "store1" });
      store2.dispatch(UserActions.login, { username: "store2" });

      assertLoggedIn(store1.stateValue);
      assertLoggedIn(store2.stateValue);
      expect(store1.stateValue.name).toBe("store1");
      expect(store2.stateValue.name).toBe("store2");
    });
  });
});

describe("type safety", () => {
  it("should preserve payload type in grouped action", () => {
    const updateProfile = createAction<{ name: string; email: string }, UserStateType>(
      "UpdateProfile"
    )
      .withPayload({ name: "", email: "" })
      .withState((state, payload) => {
        if (state._tag === "LoggedIn") {
          return UserState.LoggedIn({ ...state, ...payload });
        }
        return state;
      });

    const UserActions = createActionGroup("User", { updateProfile });

    const payload: { name: string; email: string } = { name: "Chris", email: "chris@test.com" };

    const store = createStore(UserState.LoggedIn({ name: "", email: "" }), UserState);
    store.registerGroup(UserActions);

    store.dispatch(UserActions.updateProfile, payload);

    assertLoggedIn(store.stateValue);
    expect(store.stateValue.name).toBe("Chris");
    expect(store.stateValue.email).toBe("chris@test.com");
  });
});

describe("edge cases", () => {
  it("should handle empty action group", () => {
    const EmptyActions = createActionGroup("Empty", {});

    expect(Object.keys(EmptyActions)).toHaveLength(0);
  });

  it("should handle actions without payload", () => {
    const logout = createAction("Logout").withState(() => UserState.LoggedOut({}));

    const UserActions = createActionGroup("User", { logout });

    const store = createStore(
      UserState.LoggedIn({ name: "Test", email: "test@test.com" }),
      UserState
    );
    store.registerGroup(UserActions);

    store.dispatch(UserActions.logout);

    assertLoggedOut(store.stateValue);
  });

  it("should not mutate original action type", () => {
    const login = createAction<{ username: string }, UserStateType>("Login")
      .withPayload({ username: "" })
      .withState((_, payload) => UserState.LoggedIn({ name: payload.username, email: "" }));

    const originalType = login.type;

    const UserActions = createActionGroup("User", { login });

    expect(login.type).toBe(originalType);
    expect(UserActions.login.type).toBe("tagix/action/User/Login");
  });
});
