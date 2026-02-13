import { describe, it, expect } from "vitest";
import {
  createContext,
  createAction,
  createAsyncAction,
  createStore,
  createActionGroup,
  taggedEnum,
  deriveStore,
  fork,
} from "../../index";
import {
  useStore,
  useSelector,
  useSubscribe,
  useKey,
  useDispatch,
  createSelector,
  useGetState,
  getStateProp,
  useMatch,
  useMatchPartial,
  useWhen,
  useActionGroup,
} from "../index";

describe("hooks utilities", () => {
  const UserState = taggedEnum({
    LoggedOut: {},
    LoggedIn: { name: "", email: "", role: "user" as "user" | "admin" },
  });
  type UserStateType = typeof UserState.State;

  const CounterState = taggedEnum({
    Idle: { value: 0 },
    Loading: {},
    Active: { value: 0, lastUpdated: "" },
  });
  type CounterStateType = typeof CounterState.State;

  const CartState = taggedEnum({
    Empty: {},
    Items: {
      items: [] as { id: string; name: string; price: number; quantity: number }[],
      total: 0,
    },
  });
  type CartStateType = typeof CartState.State;

  const TodoState = taggedEnum({
    Pending: { todos: [] as { id: string; text: string; completed: boolean }[] },
    Completed: { todos: [] as { id: string; text: string; completed: boolean }[] },
  });
  type TodoStateType = typeof TodoState.State;

  describe("useStore", () => {
    it("should return the current state from context", () => {
      const store = createStore(UserState.LoggedOut({}), UserState);
      const context = createContext(store);

      const state = useStore(context);
      expect(state._tag).toBe("LoggedOut");
    });

    it("should return updated state after changes", () => {
      const login = createAction<{ username: string }, UserStateType>("Login")
        .withPayload({ username: "" })
        .withState((_, payload) =>
          UserState.LoggedIn({ name: payload.username, email: "", role: "user" })
        );

      const store = createStore(UserState.LoggedOut({}), UserState);
      const context = createContext(store);

      store.register("Login", login);
      store.dispatch("Login", { username: "chris" });

      const state = useStore(context);
      expect(state._tag).toBe("LoggedIn");
      const getState = useGetState<UserStateType>()(context);
      expect(getState("LoggedIn", "name")).toBe("chris");
    });

    it("should handle complex state transitions", () => {
      const increment = createAction<{ amount: number }, CounterStateType>("Increment")
        .withPayload({ amount: 0 })
        .withState((state, payload) =>
          state._tag === "Idle"
            ? CounterState.Active({ value: payload.amount, lastUpdated: new Date().toISOString() })
            : CounterState.Active({
                value: state.value + payload.amount,
                lastUpdated: new Date().toISOString(),
              })
        );

      const store = createStore(CounterState.Idle({ value: 0 }), CounterState);
      const context = createContext(store);
      store.register("Increment", increment);
      const getState = useGetState<CounterStateType>()(context);

      store.dispatch("Increment", { amount: 10 });
      expect(useStore(context)._tag).toBe("Active");
      expect(getState("Active", "value")).toBe(10);

      store.dispatch("Increment", { amount: 5 });
      expect(getState("Active", "value")).toBe(15);
    });

    it("should work with deeply nested state", () => {
      const todos = [
        { id: "1", text: "Learn Tagix", completed: false },
        { id: "2", text: "Write tests", completed: true },
      ];
      const store = createStore(TodoState.Pending({ todos }), TodoState);
      const context = createContext(store);

      const state = useStore(context);
      expect(state._tag).toBe("Pending");
      expect(state.todos).toHaveLength(2);
    });
  });

  describe("useSelector", () => {
    it("should return derived value from state", () => {
      const store = createStore(
        UserState.LoggedIn({ name: "Michael", email: "michael@test.com", role: "user" }),
        UserState
      );
      const context = createContext(store);

      const name = useSelector(context, (state) => (state._tag === "LoggedIn" ? state.name : null));

      expect(name).toBe("Michael");
    });

    it("should return null for non-matching state", () => {
      const store = createStore(UserState.LoggedOut({}), UserState);
      const context = createContext(store);

      const name = useSelector(context, (state) => (state._tag === "LoggedIn" ? state.name : null));

      expect(name).toBeNull();
    });

    it("should handle computed values", () => {
      const store = createStore(
        CartState.Items({
          items: [
            { id: "1", name: "Widget", price: 29.99, quantity: 2 },
            { id: "2", name: "Gadget", price: 49.99, quantity: 1 },
          ],
          total: 0,
        }),
        CartState
      );
      const context = createContext(store);

      const itemCount = useSelector(context, (state) =>
        state._tag === "Items" ? state.items.length : 0
      );
      expect(itemCount).toBe(2);

      const total = useSelector(context, (state) =>
        state._tag === "Items"
          ? state.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
          : 0
      );
      expect(total).toBe(109.97);
    });

    it("should handle selector with complex filtering", () => {
      const todos = [
        { id: "1", text: "Task 1", completed: false },
        { id: "2", text: "Task 2", completed: true },
        { id: "3", text: "Task 3", completed: false },
      ];
      const store = createStore(TodoState.Pending({ todos }), TodoState);
      const context = createContext(store);

      const completedCount = useSelector(context, (state) =>
        state._tag === "Pending" ? state.todos.filter((t) => t.completed).length : 0
      );
      expect(completedCount).toBe(1);

      const pendingCount = useSelector(context, (state) =>
        state._tag === "Pending" ? state.todos.filter((t) => !t.completed).length : 0
      );
      expect(pendingCount).toBe(2);
    });

    it("should handle union types correctly", () => {
      const store = createStore(
        UserState.LoggedIn({ name: "Admin", email: "admin@test.com", role: "admin" }),
        UserState
      );
      const context = createContext(store);

      const role = useSelector(context, (state) =>
        state._tag === "LoggedIn" ? state.role : "guest"
      );
      expect(role).toBe("admin");
    });
  });

  describe("useSubscribe", () => {
    it("should subscribe to state changes", () => {
      const login = createAction<{ username: string }, UserStateType>("Login")
        .withPayload({ username: "" })
        .withState((_, payload) =>
          UserState.LoggedIn({ name: payload.username, email: "", role: "user" })
        );

      const store = createStore(UserState.LoggedOut({}), UserState);
      const context = createContext(store);
      store.register("Login", login);

      let callCount = 0;
      const unsubscribe = useSubscribe(context, () => {
        callCount++;
      });

      expect(callCount).toBe(1);

      store.dispatch("Login", { username: "chris" });
      expect(callCount).toBe(2);

      store.dispatch("Login", { username: "michael" });
      expect(callCount).toBe(3);

      unsubscribe();
    });

    it("should receive latest state in callback", () => {
      const increment = createAction<{ amount: number }, CounterStateType>("Increment")
        .withPayload({ amount: 0 })
        .withState((state, payload) =>
          state._tag === "Idle"
            ? CounterState.Active({ value: payload.amount, lastUpdated: "" })
            : CounterState.Active({ value: state.value + payload.amount, lastUpdated: "" })
        );

      const store = createStore(CounterState.Idle({ value: 0 }), CounterState);
      const context = createContext(store);
      store.register("Increment", increment);

      let lastValue = 0;
      useSubscribe(context, (state) => {
        if (state._tag === "Active") {
          lastValue = state.value;
        }
      });

      store.dispatch("Increment", { amount: 10 });
      expect(lastValue).toBe(10);

      store.dispatch("Increment", { amount: 5 });
      expect(lastValue).toBe(15);
    });

    it("should handle rapid state changes", () => {
      const store = createStore(CounterState.Idle({ value: 0 }), CounterState);
      const context = createContext(store);

      const increment = createAction<{ amount: number }, CounterStateType>("Increment")
        .withPayload({ amount: 0 })
        .withState((state, payload) =>
          state._tag === "Idle"
            ? CounterState.Active({ value: payload.amount, lastUpdated: "" })
            : CounterState.Active({ value: state.value + payload.amount, lastUpdated: "" })
        );
      store.register("Increment", increment);

      let callCount = 0;
      useSubscribe(context, () => {
        callCount++;
      });

      store.dispatch("Increment", { amount: 1 });
      store.dispatch("Increment", { amount: 2 });
      store.dispatch("Increment", { amount: 3 });

      expect(callCount).toBe(4);
    });

    it("should allow multiple subscribers", () => {
      const store = createStore(CounterState.Idle({ value: 0 }), CounterState);
      const context = createContext(store);

      const increment = createAction<{ amount: number }, CounterStateType>("Increment")
        .withPayload({ amount: 0 })
        .withState((state, payload) =>
          state._tag === "Idle"
            ? CounterState.Active({ value: payload.amount, lastUpdated: "" })
            : CounterState.Active({ value: state.value + payload.amount, lastUpdated: "" })
        );
      store.register("Increment", increment);

      let callCount1 = 0;
      let callCount2 = 0;

      const unsub1 = useSubscribe(context, () => {
        callCount1++;
      });
      const unsub2 = useSubscribe(context, () => {
        callCount2++;
      });

      expect(callCount1).toBe(1);
      expect(callCount2).toBe(1);

      unsub1();
      store.dispatch("Increment", { amount: 3 });

      expect(callCount1).toBe(1);
      expect(callCount2).toBe(2);

      unsub2();
    });
  });

  describe("useKey", () => {
    it("should return specific property from state", () => {
      const store = createStore(CounterState.Idle({ value: 5 }), CounterState);
      const context = createContext(store);

      const count = useKey(context, "_tag");
      expect(count).toBe("Idle");
    });

    it("should return undefined for missing property", () => {
      const store = createStore(UserState.LoggedOut({}), UserState);
      const context = createContext(store);

      const name = useKey(context, "name" as "_tag");
      expect(name).toBeUndefined();
    });

    it("should handle nested property access", () => {
      const todos = [{ id: "1", text: "Test", completed: false }];
      const store = createStore(TodoState.Pending({ todos }), TodoState);
      const context = createContext(store);

      const todosValue = useKey(context, "todos");
      expect(todosValue).toEqual(todos);
    });
  });

  describe("useDispatch", () => {
    it("should return dispatch function", () => {
      const login = createAction<{ username: string }, UserStateType>("Login")
        .withPayload({ username: "" })
        .withState((_, payload) =>
          UserState.LoggedIn({ name: payload.username, email: "", role: "user" })
        );

      const store = createStore(UserState.LoggedOut({}), UserState);
      const context = createContext(store);
      store.register("Login", login);

      const dispatch = useDispatch(context);
      dispatch("Login", { username: "chris" });

      expect(context.getCurrent()._tag).toBe("LoggedIn");
    });

    it("should handle async actions", async () => {
      const fetchUser = createAsyncAction<
        { id: string },
        UserStateType,
        { name: string; email: string }
      >("FetchUser")
        .state((s) => s)
        .effect(async (payload) => {
          await new Promise((r) => setTimeout(r, 10));
          return { name: "Fetched User", email: `${payload.id}@test.com` };
        })
        .onSuccess((_, user) =>
          UserState.LoggedIn({ name: user.name, email: user.email, role: "user" })
        )
        .onError(() => UserState.LoggedOut({}));

      const store = createStore(UserState.LoggedOut({}), UserState);
      const context = createContext(store);
      store.register("FetchUser", fetchUser);

      const dispatch = useDispatch(context);
      await dispatch("FetchUser", { id: "123" });

      expect(context.getCurrent()._tag).toBe("LoggedIn");
      const getState = useGetState<UserStateType>()(context);
      expect(getState("LoggedIn", "name")).toBe("Fetched User");
    });

    it("should dispatch multiple actions", () => {
      const login = createAction<{ username: string }, UserStateType>("Login")
        .withPayload({ username: "" })
        .withState((_, payload) =>
          UserState.LoggedIn({ name: payload.username, email: "", role: "user" })
        );

      const logout = createAction("Logout").withState(() => UserState.LoggedOut({}));

      const store = createStore(UserState.LoggedOut({}), UserState);
      const context = createContext(store);
      store.register("Login", login);
      store.register("Logout", logout);

      const dispatch = useDispatch(context);

      dispatch("Login", { username: "chris" });
      expect(context.getCurrent()._tag).toBe("LoggedIn");

      dispatch("Logout", undefined);
      expect(context.getCurrent()._tag).toBe("LoggedOut");
    });
  });

  describe("createSelector", () => {
    it("should create a selector function", () => {
      const store = createStore(
        UserState.LoggedIn({ name: "Michael", email: "michael@test.com", role: "user" }),
        UserState
      );
      const context = createContext(store);

      const getName = createSelector(context, (state) =>
        state._tag === "LoggedIn" ? state.name : null
      );

      expect(getName()).toBe("Michael");
    });

    it("should return current value each call", () => {
      const login = createAction<{ username: string }, UserStateType>("Login")
        .withPayload({ username: "" })
        .withState((_, payload) =>
          UserState.LoggedIn({ name: payload.username, email: "", role: "user" })
        );

      const store = createStore(UserState.LoggedOut({}), UserState);
      const context = createContext(store);
      store.register("Login", login);

      const getTag = createSelector(context, (state) => state._tag);

      expect(getTag()).toBe("LoggedOut");

      store.dispatch("Login", { username: "chris" });
      expect(getTag()).toBe("LoggedIn");
    });

    it("should handle computed selectors", () => {
      const store = createStore(
        CartState.Items({
          items: [
            { id: "1", name: "Item A", price: 25, quantity: 2 },
            { id: "2", name: "Item B", price: 75, quantity: 1 },
          ],
          total: 0,
        }),
        CartState
      );
      const context = createContext(store);

      const getItemCount = createSelector(context, (state) =>
        state._tag === "Items" ? state.items.length : 0
      );
      const getTotal = createSelector(context, (state) =>
        state._tag === "Items"
          ? state.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
          : 0
      );

      expect(getItemCount()).toBe(2);
      expect(getTotal()).toBe(125);
    });

    it("should work with multiple selectors", () => {
      const store = createStore(
        UserState.LoggedIn({ name: "Multi", email: "multi@test.com", role: "user" }),
        UserState
      );
      const context = createContext(store);

      const getName = createSelector(context, (s) => (s._tag === "LoggedIn" ? s.name : null));
      const getEmail = createSelector(context, (s) => (s._tag === "LoggedIn" ? s.email : null));
      const getFullInfo = createSelector(context, (s) =>
        s._tag === "LoggedIn" ? `${s.name} (${s.role})` : "guest"
      );

      expect(getName()).toBe("Multi");
      expect(getEmail()).toBe("multi@test.com");
      expect(getFullInfo()).toBe("Multi (user)");
    });
  });

  describe("useGetState", () => {
    it("should get a single property by tag and key", () => {
      const store = createStore(
        UserState.LoggedIn({ name: "Chris", email: "chris@test.com", role: "user" }),
        UserState
      );
      const context = createContext(store);
      const getState = useGetState<UserStateType>()(context);

      expect(getState("LoggedIn", "name")).toBe("Chris");
      expect(getState("LoggedIn", "email")).toBe("chris@test.com");
      expect(getState("LoggedIn", "role")).toBe("user");
    });

    it("should get the whole props object for a tag", () => {
      const store = createStore(
        UserState.LoggedIn({ name: "Michael", email: "michael@test.com", role: "admin" }),
        UserState
      );
      const context = createContext(store);
      const getState = useGetState<UserStateType>()(context);

      const props = getState("LoggedIn")!;
      expect(props.name).toBe("Michael");
      expect(props.email).toBe("michael@test.com");
      expect(props.role).toBe("admin");
    });

    it("should return undefined for non-matching tag", () => {
      const store = createStore(UserState.LoggedOut({}), UserState);
      const context = createContext(store);
      const getState = useGetState<UserStateType>()(context);

      expect(getState("LoggedIn")).toBeUndefined();
      expect(getState("LoggedIn", "name")).toBeUndefined();
    });

    it("should access multiple properties from props object", () => {
      const store = createStore(
        UserState.LoggedIn({ name: "Test", email: "test@test.com", role: "user" }),
        UserState
      );
      const context = createContext(store);
      const getState = useGetState<UserStateType>()(context);

      const props = getState("LoggedIn")!;
      expect(props.name).toBe("Test");
      expect(props.email).toBe("test@test.com");
      expect(props.role).toBe("user");
    });

    it("should work with counter state", () => {
      const store = createStore(
        CounterState.Active({ value: 42, lastUpdated: "2026-02-13" }),
        CounterState
      );
      const context = createContext(store);
      const getState = useGetState<CounterStateType>()(context);

      expect(getState("Active", "value")).toBe(42);
      expect(getState("Active", "lastUpdated")).toBe("2026-02-13");

      const activeProps = getState("Active")!;
      expect(activeProps.value).toBe(42);
      expect(activeProps.lastUpdated).toBe("2026-02-13");
    });

    it("should work with cart state", () => {
      const store = createStore(
        CartState.Items({
          items: [
            { id: "1", name: "Widget", price: 29.99, quantity: 2 },
            { id: "2", name: "Gadget", price: 49.99, quantity: 1 },
          ],
          total: 0,
        }),
        CartState
      );
      const context = createContext(store);
      const getState = useGetState<CartStateType>()(context);

      expect(getState("Items", "items")).toHaveLength(2);
      expect(getState("Items", "total")).toBe(0);

      const itemsProps = getState("Items")!;
      expect(itemsProps.items).toHaveLength(2);
      expect(itemsProps.total).toBe(0);
    });
  });

  describe("getStateProp", () => {
    it("should get a single property from state object", () => {
      const store = createStore(
        UserState.LoggedIn({ name: "Chris", email: "chris@test.com", role: "user" }),
        UserState
      );
      const context = createContext(store);
      const state = useStore(context);
      const getProp = getStateProp(state);

      expect(getProp("LoggedIn", "name")).toBe("Chris");
      expect(getProp("LoggedIn", "email")).toBe("chris@test.com");
    });

    it("should get the whole props object for a tag", () => {
      const store = createStore(
        UserState.LoggedIn({ name: "Michael", email: "michael@test.com", role: "admin" }),
        UserState
      );
      const context = createContext(store);
      const state = useStore(context);
      const getProp = getStateProp(state);

      const props = getProp("LoggedIn")!;
      expect(props.name).toBe("Michael");
      expect(props.email).toBe("michael@test.com");
      expect(props.role).toBe("admin");
    });

    it("should return undefined for non-matching tag", () => {
      const store = createStore(UserState.LoggedOut({}), UserState);
      const context = createContext(store);
      const state = useStore(context);
      const getProp = getStateProp(state);
      expect(getProp("LoggedIn")).toBeUndefined();
      expect(getProp("LoggedIn", "name")).toBeUndefined();
    });

    it("should work with counter state", () => {
      const store = createStore(
        CounterState.Active({ value: 100, lastUpdated: "2026-02-13" }),
        CounterState
      );
      const context = createContext(store);
      const state = useStore(context);
      const getProp = getStateProp(state);

      expect(getProp("Active", "value")).toBe(100);

      const activeProps = getProp("Active")!;
      expect(activeProps.value).toBe(100);
      expect(activeProps.lastUpdated).toBe("2026-02-13");
    });
  });

  describe("real-world scenarios", () => {
    it("should work with action groups", () => {
      const login = createAction<{ username: string }, UserStateType>("Login")
        .withPayload({ username: "" })
        .withState((_, payload) =>
          UserState.LoggedIn({ name: payload.username, email: "", role: "user" })
        );

      const logout = createAction("Logout").withState(() => UserState.LoggedOut({}));

      const UserActions = createActionGroup("Auth", { login, logout });

      const store = createStore(UserState.LoggedOut({}), UserState);
      store.registerGroup(UserActions);
      const context = createContext(store);

      const dispatch = useDispatch(context);
      dispatch("Auth/Login", { username: "groupuser" });
      const getState = useGetState<UserStateType>()(context);

      expect(useStore(context)._tag).toBe("LoggedIn");
      expect(getState("LoggedIn", "name")).toBe("groupuser");

      dispatch("Auth/Logout", undefined);
      expect(useStore(context)._tag).toBe("LoggedOut");
    });

    it("should work with forked contexts", () => {
      const login = createAction<{ username: string }, UserStateType>("Login")
        .withPayload({ username: "" })
        .withState((_, payload) =>
          UserState.LoggedIn({ name: payload.username, email: "", role: "user" })
        );

      const store = createStore(UserState.LoggedOut({}), UserState);
      store.register("Login", login);
      const context = createContext(store);

      const forkedStore = fork(store);
      const forkedContext = createContext(forkedStore);
      const forkedDispatch = useDispatch(forkedContext);

      const mainState = useStore(context);
      const forkState = useStore(forkedContext);

      expect(mainState._tag).toBe("LoggedOut");
      expect(forkState._tag).toBe("LoggedOut");

      forkedDispatch("Login", { username: "forked" });

      expect(useStore(forkedContext)._tag).toBe("LoggedIn");
      expect(useStore(context)._tag).toBe("LoggedOut");
    });

    it("should work with derived stores", () => {
      const increment = createAction<{ amount: number }, CounterStateType>("Increment")
        .withPayload({ amount: 0 })
        .withState((state, payload) =>
          state._tag === "Idle"
            ? CounterState.Active({ value: payload.amount, lastUpdated: "" })
            : CounterState.Active({ value: state.value + payload.amount, lastUpdated: "" })
        );

      const store = createStore(CounterState.Idle({ value: 0 }), CounterState);
      store.register("Increment", increment);

      const doubleStore = deriveStore([store], ([s]) => (s._tag === "Active" ? s.value * 2 : 0));

      const context = createContext(store);

      store.dispatch("Increment", { amount: 10 });
      expect(doubleStore.stateValue).toBe(20);

      store.dispatch("Increment", { amount: 5 });
      expect(doubleStore.stateValue).toBe(30);

      const doubleValue = useSelector(context, (s) => (s._tag === "Active" ? s.value * 2 : 0));
      expect(doubleValue).toBe(30);
    });

    it("should handle todo list operations", async () => {
      const addTodo = createAction<{ id: string; text: string }, TodoStateType>("AddTodo")
        .withPayload({ id: "", text: "" })
        .withState((state, payload) =>
          state._tag === "Pending"
            ? TodoState.Pending({
                todos: [...state.todos, { id: payload.id, text: payload.text, completed: false }],
              })
            : state
        );

      const toggleTodo = createAction<{ id: string }, TodoStateType>("ToggleTodo")
        .withPayload({ id: "" })
        .withState((state, payload) =>
          state._tag === "Pending"
            ? TodoState.Pending({
                todos: state.todos.map((t) =>
                  t.id === payload.id ? { ...t, completed: !t.completed } : t
                ),
              })
            : state
        );

      const store = createStore(TodoState.Pending({ todos: [] }), TodoState);
      store.register("AddTodo", addTodo);
      store.register("ToggleTodo", toggleTodo);
      const context = createContext(store);

      const dispatch = useDispatch(context);
      await dispatch("AddTodo", { id: "todo-1", text: "Learn Tagix" });
      await dispatch("AddTodo", { id: "todo-2", text: "Write tests" });

      const todos = useSelector(context, (s) => (s._tag === "Pending" ? s.todos : []));
      expect(todos).toHaveLength(2);

      await dispatch("ToggleTodo", { id: "todo-1" });

      const updatedTodos = useSelector(context, (s) => (s._tag === "Pending" ? s.todos : []));
      expect(updatedTodos[0].completed).toBe(true);
      expect(updatedTodos[1].completed).toBe(false);
    });

    it("should handle shopping cart operations", () => {
      const addItem = createAction<{ id: string; name: string; price: number }, CartStateType>(
        "AddItem"
      )
        .withPayload({ id: "", name: "", price: 0 })
        .withState((state, payload) =>
          state._tag === "Items"
            ? CartState.Items({ items: [...state.items, { ...payload, quantity: 1 }], total: 0 })
            : CartState.Items({ items: [{ ...payload, quantity: 1 }], total: 0 })
        );

      const removeItem = createAction<{ id: string }, CartStateType>("RemoveItem")
        .withPayload({ id: "" })
        .withState((state, payload) =>
          state._tag === "Items"
            ? CartState.Items({ items: state.items.filter((i) => i.id !== payload.id), total: 0 })
            : state
        );

      const store = createStore(CartState.Empty({}), CartState);
      store.register("AddItem", addItem);
      store.register("RemoveItem", removeItem);
      const context = createContext(store);

      const dispatch = useDispatch(context);

      dispatch("AddItem", { id: "1", name: "Widget", price: 29.99 });
      dispatch("AddItem", { id: "2", name: "Gadget", price: 49.99 });

      const itemCount = useSelector(context, (s) => (s._tag === "Items" ? s.items.length : 0));
      expect(itemCount).toBe(2);

      dispatch("RemoveItem", { id: "1" });

      const remainingItems = useSelector(context, (s) => (s._tag === "Items" ? s.items : []));
      expect(remainingItems).toHaveLength(1);
      expect(remainingItems[0].name).toBe("Gadget");
    });

    it("should handle user session management", async () => {
      const login = createAction<{ username: string; email: string }, UserStateType>("Login")
        .withPayload({ username: "", email: "" })
        .withState((_, payload) =>
          UserState.LoggedIn({ name: payload.username, email: payload.email, role: "user" })
        );

      const logout = createAction("Logout").withState(() => UserState.LoggedOut({}));

      const store = createStore(UserState.LoggedOut({}), UserState);
      store.register("Login", login);
      store.register("Logout", logout);
      const context = createContext(store);

      const isLoggedIn = createSelector(context, (s) => s._tag === "LoggedIn");
      const getUserName = createSelector(context, (s) => (s._tag === "LoggedIn" ? s.name : null));
      const getUserRole = createSelector(context, (s) => (s._tag === "LoggedIn" ? s.role : null));

      expect(isLoggedIn()).toBe(false);
      expect(getUserName()).toBeNull();
      expect(getUserRole()).toBeNull();

      const dispatch = useDispatch(context);
      await dispatch("Login", { username: "admin", email: "admin@test.com" });

      expect(isLoggedIn()).toBe(true);
      expect(getUserName()).toBe("admin");
      expect(getUserRole()).toBe("user");

      dispatch("Logout", undefined);

      expect(isLoggedIn()).toBe(false);
      expect(getUserName()).toBeNull();
      expect(getUserRole()).toBeNull();
    });

    it("should handle counter with multiple subscribers", () => {
      const increment = createAction<{ amount: number }, CounterStateType>("Increment")
        .withPayload({ amount: 0 })
        .withState((state, payload) =>
          state._tag === "Idle"
            ? CounterState.Active({ value: payload.amount, lastUpdated: "" })
            : CounterState.Active({ value: state.value + payload.amount, lastUpdated: "" })
        );

      const store = createStore(CounterState.Idle({ value: 0 }), CounterState);
      store.register("Increment", increment);
      const context = createContext(store);

      const valueHistory: number[] = [];
      const unsub1 = useSubscribe(context, (s) => {
        if (s._tag === "Active") {
          valueHistory.push(s.value);
        }
      });

      const getValue = createSelector(context, (s) => (s._tag === "Active" ? s.value : 0));

      const dispatch = useDispatch(context);

      dispatch("Increment", { amount: 5 });
      expect(getValue()).toBe(5);
      expect(valueHistory).toEqual([5]);

      dispatch("Increment", { amount: 3 });
      expect(getValue()).toBe(8);
      expect(valueHistory).toEqual([5, 8]);

      unsub1();

      dispatch("Increment", { amount: 2 });
      expect(getValue()).toBe(10);
      expect(valueHistory).toEqual([5, 8]);
    });
  });

  describe("edge cases", () => {
    it("should handle empty arrays in state", () => {
      const store = createStore(TodoState.Pending({ todos: [] }), TodoState);
      const context = createContext(store);

      const todoCount = useSelector(context, (s) => (s._tag === "Pending" ? s.todos.length : 0));
      expect(todoCount).toBe(0);

      const todos = useSelector(context, (s) => (s._tag === "Pending" ? s.todos : []));
      expect(todos).toEqual([]);
    });

    it("should handle rapid dispatch calls", () => {
      const store = createStore(CounterState.Idle({ value: 0 }), CounterState);
      const context = createContext(store);

      const increment = createAction<{ amount: number }, CounterStateType>("Increment")
        .withPayload({ amount: 0 })
        .withState((state, payload) =>
          state._tag === "Idle"
            ? CounterState.Active({ value: payload.amount, lastUpdated: "" })
            : CounterState.Active({ value: state.value + payload.amount, lastUpdated: "" })
        );
      store.register("Increment", increment);

      const dispatch = useDispatch(context);

      for (let i = 0; i < 100; i++) {
        dispatch("Increment", { amount: 1 });
      }

      const finalValue = useSelector(context, (s) => (s._tag === "Active" ? s.value : 0));
      expect(finalValue).toBe(100);
    });

    it("should handle selector that returns objects", () => {
      const store = createStore(
        UserState.LoggedIn({ name: "Object", email: "obj@test.com", role: "user" }),
        UserState
      );
      const context = createContext(store);

      const getUserObj = useSelector(context, (s) =>
        s._tag === "LoggedIn" ? { name: s.name, role: s.role } : null
      );

      expect(getUserObj).toEqual({ name: "Object", role: "user" });
    });

    it("should handle boolean selectors", () => {
      const store = createStore(
        UserState.LoggedIn({ name: "Bool", email: "bool@test.com", role: "user" }),
        UserState
      );
      const context = createContext(store);

      const isAuthenticated = createSelector(context, (s) => s._tag === "LoggedIn");
      const isAdmin = createSelector(context, (s) => s._tag === "LoggedIn" && s.role === "admin");

      expect(isAuthenticated()).toBe(true);
      expect(isAdmin()).toBe(false);
    });

    it("should handle numeric computed values", () => {
      const store = createStore(
        CartState.Items({
          items: [
            { id: "1", name: "A", price: 10, quantity: 2 },
            { id: "2", name: "B", price: 20, quantity: 3 },
            { id: "3", name: "C", price: 5, quantity: 4 },
          ],
          total: 0,
        }),
        CartState
      );
      const context = createContext(store);

      const total = useSelector(context, (s) =>
        s._tag === "Items" ? s.items.reduce((sum, i) => sum + i.price * i.quantity, 0) : 0
      );

      expect(total).toBe(100);
    });
  });

  describe("useMatch", () => {
    it("should exhaustively match and return the correct handler result", () => {
      const store = createStore(
        UserState.LoggedIn({ name: "Chris", email: "chris@test.com", role: "admin" }),
        UserState
      );
      const context = createContext(store);

      const name = useMatch(context, {
        LoggedIn: (s) => s.name,
        LoggedOut: () => null,
      });

      expect(name).toBe("Chris");
    });

    it("should match the LoggedOut variant", () => {
      const store = createStore(UserState.LoggedOut({}), UserState);
      const context = createContext(store);

      const name = useMatch(context, {
        LoggedIn: (s) => s.name,
        LoggedOut: () => null,
      });

      expect(name).toBeNull();
    });

    it("should handle complex return types", () => {
      const store = createStore(
        UserState.LoggedIn({ name: "Admin", email: "admin@test.com", role: "admin" }),
        UserState
      );
      const context = createContext(store);

      const userInfo = useMatch(context, {
        LoggedIn: (s) => ({ displayName: s.name, isAdmin: s.role === "admin" }),
        LoggedOut: () => ({ displayName: "Guest", isAdmin: false }),
      });

      expect(userInfo).toEqual({ displayName: "Admin", isAdmin: true });
    });

    it("should work with counter state having multiple variants", () => {
      const store = createStore(CounterState.Loading({}), CounterState);
      const context = createContext(store);

      const display = useMatch(context, {
        Idle: (s) => `Idle: ${s.value}`,
        Loading: () => "Loading...",
        Active: (s) => `Active: ${s.value}`,
      });

      expect(display).toBe("Loading...");
    });

    it("should reflect state changes", () => {
      const login = createAction<{ username: string }, UserStateType>("Login")
        .withPayload({ username: "" })
        .withState((_, payload) =>
          UserState.LoggedIn({ name: payload.username, email: "", role: "user" })
        );

      const store = createStore(UserState.LoggedOut({}), UserState);
      const context = createContext(store);
      store.register("Login", login);

      const nameBefore = useMatch(context, {
        LoggedIn: (s) => s.name,
        LoggedOut: () => "anonymous",
      });
      expect(nameBefore).toBe("anonymous");

      store.dispatch("Login", { username: "chris" });

      const nameAfter = useMatch(context, {
        LoggedIn: (s) => s.name,
        LoggedOut: () => "anonymous",
      });
      expect(nameAfter).toBe("chris");
    });

    it("should work with cart state", () => {
      const store = createStore(
        CartState.Items({
          items: [
            { id: "1", name: "Widget", price: 29.99, quantity: 2 },
            { id: "2", name: "Gadget", price: 49.99, quantity: 1 },
          ],
          total: 0,
        }),
        CartState
      );
      const context = createContext(store);

      const total = useMatch(context, {
        Items: (s) => s.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
        Empty: () => 0,
      });

      expect(total).toBeCloseTo(109.97);
    });
  });

  describe("useMatchPartial", () => {
    it("should return handler result for matching variant", () => {
      const store = createStore(
        UserState.LoggedIn({ name: "Michael", email: "michael@test.com", role: "user" }),
        UserState
      );
      const context = createContext(store);

      const email = useMatchPartial(context, {
        LoggedIn: (s) => s.email,
      });

      expect(email).toBe("michael@test.com");
    });

    it("should return undefined for non-matching variant", () => {
      const store = createStore(UserState.LoggedOut({}), UserState);
      const context = createContext(store);

      const email = useMatchPartial(context, {
        LoggedIn: (s) => s.email,
      });

      expect(email).toBeUndefined();
    });

    it("should handle partial cases on multi-variant state", () => {
      const store = createStore(CounterState.Loading({}), CounterState);
      const context = createContext(store);

      const value = useMatchPartial(context, {
        Active: (s) => s.value,
        Idle: (s) => s.value,
      });

      expect(value).toBeUndefined();
    });

    it("should work when only one variant is handled", () => {
      const store = createStore(
        CartState.Items({
          items: [{ id: "1", name: "A", price: 10, quantity: 1 }],
          total: 0,
        }),
        CartState
      );
      const context = createContext(store);

      const count = useMatchPartial(context, {
        Items: (s) => s.items.length,
      });

      expect(count).toBe(1);
    });
  });

  describe("useWhen", () => {
    it("should return props when tag matches", () => {
      const store = createStore(
        UserState.LoggedIn({ name: "Chris", email: "chris@test.com", role: "admin" }),
        UserState
      );
      const context = createContext(store);

      const user = useWhen(context, "LoggedIn");

      expect(user).toBeDefined();
      expect(user!.name).toBe("Chris");
      expect(user!.email).toBe("chris@test.com");
      expect(user!.role).toBe("admin");
    });

    it("should return undefined when tag does not match", () => {
      const store = createStore(UserState.LoggedOut({}), UserState);
      const context = createContext(store);

      const user = useWhen(context, "LoggedIn");

      expect(user).toBeUndefined();
    });

    it("should not include _tag in the returned object", () => {
      const store = createStore(
        UserState.LoggedIn({ name: "Test", email: "test@test.com", role: "user" }),
        UserState
      );
      const context = createContext(store);

      const user = useWhen(context, "LoggedIn");

      expect(user).toBeDefined();
      expect("_tag" in user!).toBe(false);
    });

    it("should work with counter Active variant", () => {
      const store = createStore(
        CounterState.Active({ value: 42, lastUpdated: "2026-02-13" }),
        CounterState
      );
      const context = createContext(store);

      const active = useWhen(context, "Active");

      expect(active).toBeDefined();
      expect(active!.value).toBe(42);
      expect(active!.lastUpdated).toBe("2026-02-13");
    });

    it("should return undefined for wrong variant on counter", () => {
      const store = createStore(CounterState.Idle({ value: 0 }), CounterState);
      const context = createContext(store);

      const active = useWhen(context, "Active");
      expect(active).toBeUndefined();

      const loading = useWhen(context, "Loading");
      expect(loading).toBeUndefined();
    });

    it("should reflect state changes", () => {
      const login = createAction<{ username: string }, UserStateType>("Login")
        .withPayload({ username: "" })
        .withState((_, payload) =>
          UserState.LoggedIn({ name: payload.username, email: "", role: "user" })
        );

      const store = createStore(UserState.LoggedOut({}), UserState);
      const context = createContext(store);
      store.register("Login", login);

      expect(useWhen(context, "LoggedIn")).toBeUndefined();
      expect(useWhen(context, "LoggedOut")).toBeDefined();

      store.dispatch("Login", { username: "chris" });

      const user = useWhen(context, "LoggedIn");
      expect(user).toBeDefined();
      expect(user!.name).toBe("chris");
      expect(useWhen(context, "LoggedOut")).toBeUndefined();
    });

    it("should work with cart Items variant", () => {
      const items = [
        { id: "1", name: "Widget", price: 29.99, quantity: 2 },
        { id: "2", name: "Gadget", price: 49.99, quantity: 1 },
      ];
      const store = createStore(CartState.Items({ items, total: 109.97 }), CartState);
      const context = createContext(store);

      const cart = useWhen(context, "Items");
      expect(cart).toBeDefined();
      expect(cart!.items).toHaveLength(2);
      expect(cart!.total).toBe(109.97);
    });
  });

  describe("useDispatch (typed)", () => {
    it("should dispatch using action object reference", () => {
      const login = createAction<{ username: string }, UserStateType>("Login")
        .withPayload({ username: "" })
        .withState((_, payload) =>
          UserState.LoggedIn({ name: payload.username, email: "", role: "user" })
        );

      const store = createStore(UserState.LoggedOut({}), UserState);
      const context = createContext(store);
      store.register("Login", login);

      const dispatch = useDispatch(context);
      dispatch(login, { username: "typed-chris" });

      expect(context.getCurrent()._tag).toBe("LoggedIn");
      const user = useWhen(context, "LoggedIn");
      expect(user!.name).toBe("typed-chris");
    });

    it("should dispatch async actions using action object reference", async () => {
      const fetchUser = createAsyncAction<
        { id: string },
        UserStateType,
        { name: string; email: string }
      >("FetchUser")
        .state((s) => s)
        .effect(async (payload) => {
          await new Promise((r) => setTimeout(r, 10));
          return { name: "Fetched", email: `${payload.id}@test.com` };
        })
        .onSuccess((_, user) =>
          UserState.LoggedIn({ name: user.name, email: user.email, role: "user" })
        )
        .onError(() => UserState.LoggedOut({}));

      const store = createStore(UserState.LoggedOut({}), UserState);
      const context = createContext(store);
      store.register("FetchUser", fetchUser);

      const dispatch = useDispatch(context);
      await dispatch(fetchUser, { id: "123" });

      expect(context.getCurrent()._tag).toBe("LoggedIn");
      const user = useWhen(context, "LoggedIn");
      expect(user!.name).toBe("Fetched");
      expect(user!.email).toBe("123@test.com");
    });

    it("should still support legacy string-based dispatch", () => {
      const login = createAction<{ username: string }, UserStateType>("Login")
        .withPayload({ username: "" })
        .withState((_, payload) =>
          UserState.LoggedIn({ name: payload.username, email: "", role: "user" })
        );

      const store = createStore(UserState.LoggedOut({}), UserState);
      const context = createContext(store);
      store.register("Login", login);

      const dispatch = useDispatch(context);
      dispatch("Login", { username: "legacy" });

      expect(context.getCurrent()._tag).toBe("LoggedIn");
    });

    it("should dispatch multiple typed actions", () => {
      const login = createAction<{ username: string }, UserStateType>("Login")
        .withPayload({ username: "" })
        .withState((_, payload) =>
          UserState.LoggedIn({ name: payload.username, email: "", role: "user" })
        );

      const logout = createAction<Record<string, never>, UserStateType>("Logout")
        .withPayload({} as Record<string, never>)
        .withState(() => UserState.LoggedOut({}));

      const store = createStore(UserState.LoggedOut({}), UserState);
      const context = createContext(store);
      store.register("Login", login);
      store.register("Logout", logout);

      const dispatch = useDispatch(context);

      dispatch(login, { username: "chris" });
      expect(context.getCurrent()._tag).toBe("LoggedIn");

      dispatch(logout, {} as Record<string, never>);
      expect(context.getCurrent()._tag).toBe("LoggedOut");
    });
  });

  describe("useActionGroup", () => {
    it("should create typed dispatchers from action group", () => {
      const login = createAction<{ username: string }, UserStateType>("Login")
        .withPayload({ username: "" })
        .withState((_, payload) =>
          UserState.LoggedIn({ name: payload.username, email: "", role: "user" })
        );

      const logout = createAction("Logout").withState(() => UserState.LoggedOut({}));

      const UserActions = createActionGroup("Auth", { login, logout });

      const store = createStore(UserState.LoggedOut({}), UserState);
      store.registerGroup(UserActions);
      const context = createContext(store);

      const dispatch = useActionGroup(context, UserActions);

      dispatch.login({ username: "group-chris" });
      expect(context.getCurrent()._tag).toBe("LoggedIn");

      const user = useWhen(context, "LoggedIn");
      expect(user!.name).toBe("group-chris");
    });

    it("should support logout via action group", () => {
      const login = createAction<{ username: string }, UserStateType>("Login")
        .withPayload({ username: "" })
        .withState((_, payload) =>
          UserState.LoggedIn({ name: payload.username, email: "", role: "user" })
        );

      const logout = createAction("Logout").withState(() => UserState.LoggedOut({}));

      const UserActions = createActionGroup("Auth", { login, logout });

      const store = createStore(UserState.LoggedOut({}), UserState);
      store.registerGroup(UserActions);
      const context = createContext(store);

      const dispatch = useActionGroup(context, UserActions);

      dispatch.login({ username: "chris" });
      expect(context.getCurrent()._tag).toBe("LoggedIn");

      dispatch.logout(undefined);
      expect(context.getCurrent()._tag).toBe("LoggedOut");
    });

    it("should handle cart action group", () => {
      const addItem = createAction<{ id: string; name: string; price: number }, CartStateType>(
        "AddItem"
      )
        .withPayload({ id: "", name: "", price: 0 })
        .withState((state, payload) =>
          state._tag === "Items"
            ? CartState.Items({ items: [...state.items, { ...payload, quantity: 1 }], total: 0 })
            : CartState.Items({ items: [{ ...payload, quantity: 1 }], total: 0 })
        );

      const clearCart = createAction("ClearCart").withState(() => CartState.Empty({}));

      const CartActions = createActionGroup("Cart", { addItem, clearCart });

      const store = createStore(CartState.Empty({}), CartState);
      store.registerGroup(CartActions);
      const context = createContext(store);

      const dispatch = useActionGroup(context, CartActions);

      dispatch.addItem({ id: "1", name: "Widget", price: 29.99 });
      dispatch.addItem({ id: "2", name: "Gadget", price: 49.99 });

      const cart = useWhen(context, "Items");
      expect(cart).toBeDefined();
      expect(cart!.items).toHaveLength(2);

      dispatch.clearCart(undefined);
      expect(context.getCurrent()._tag).toBe("Empty");
    });

    it("should work alongside useMatch", () => {
      const login = createAction<{ username: string }, UserStateType>("Login")
        .withPayload({ username: "" })
        .withState((_, payload) =>
          UserState.LoggedIn({ name: payload.username, email: "", role: "user" })
        );

      const logout = createAction("Logout").withState(() => UserState.LoggedOut({}));
      const UserActions = createActionGroup("Auth", { login, logout });

      const store = createStore(UserState.LoggedOut({}), UserState);
      store.registerGroup(UserActions);
      const context = createContext(store);

      const dispatch = useActionGroup(context, UserActions);

      const statusBefore = useMatch(context, {
        LoggedIn: (s) => `Logged in as ${s.name}`,
        LoggedOut: () => "Not authenticated",
      });
      expect(statusBefore).toBe("Not authenticated");

      dispatch.login({ username: "chris" });

      const statusAfter = useMatch(context, {
        LoggedIn: (s) => `Logged in as ${s.name}`,
        LoggedOut: () => "Not authenticated",
      });
      expect(statusAfter).toBe("Logged in as chris");
    });
  });
});
