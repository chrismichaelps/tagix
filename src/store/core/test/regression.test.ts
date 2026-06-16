import { describe, it, expect } from "vitest";
import { createStore, createAction, createAsyncAction, taggedEnum } from "../../index";
import type { Middleware } from "../../types";

const ApiState = taggedEnum({
  Idle: {},
  Loading: {},
  Success: { data: 0 },
  Error: { message: "", code: 0 },
});
type ApiStateType = typeof ApiState.State;

describe("regression: async effects are not silently auto-retried by default", () => {
  it("runs a failing effect exactly once when maxRetries is not configured", async () => {
    const store = createStore(ApiState.Idle({}), ApiState);
    let runs = 0;
    const action = createAsyncAction<void, ApiStateType, number>("Create")
      .state(() => ApiState.Loading({}))
      .effect(async () => {
        runs++;
        throw new Error("transient");
      })
      .onSuccess(() => ApiState.Success({ data: 1 }))
      .onError((s, err) => ApiState.Error({ message: (err as Error).message, code: 500 }));
    store.register("Create", action);

    await store.dispatch("tagix/action/Create", {});

    // A non-idempotent effect (e.g. POST) must not fire multiple times by default.
    expect(runs).toBe(1);
    expect(store.stateValue._tag).toBe("Error");
  });

  it("still retries when maxRetries is explicitly opted into", async () => {
    const store = createStore(ApiState.Idle({}), ApiState, { maxRetries: 3 });
    let runs = 0;
    const action = createAsyncAction<void, ApiStateType, number>("Flaky")
      .state(() => ApiState.Loading({}))
      .effect(async () => {
        runs++;
        if (runs < 3) throw new Error("transient");
        return 99;
      })
      .onSuccess((_s, result) => ApiState.Success({ data: result }))
      .onError((s) => s);
    store.register("Flaky", action);

    await store.dispatch("tagix/action/Flaky", {});

    expect(runs).toBe(3);
    expect(store.stateValue._tag).toBe("Success");
  });
});

describe("integration: end-to-end async flow against the JSONPlaceholder public API", () => {
  it("fetches data, passes it to onSuccess, and reflects it in state", async () => {
    const TodoState = taggedEnum({
      Idle: {},
      Loading: {},
      Loaded: { id: 0, title: "", completed: false },
      Failed: { message: "" },
    });
    type TodoStateType = typeof TodoState.State;

    const store = createStore(TodoState.Idle({}), TodoState);

    let effectRuns = 0;
    let receivedInOnSuccess: { id: number; title: string; completed: boolean } | null = null;

    const fetchTodo = createAsyncAction<
      { id: number },
      TodoStateType,
      { id: number; title: string; completed: boolean }
    >("FetchTodo")
      .state(() => TodoState.Loading({}))
      .effect(async (payload) => {
        effectRuns++;
        const res = await fetch(`https://jsonplaceholder.typicode.com/todos/${payload.id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .onSuccess((_s, todo) => {
        receivedInOnSuccess = todo;
        return TodoState.Loaded({ id: todo.id, title: todo.title, completed: todo.completed });
      })
      .onError((_s, err) => TodoState.Failed({ message: (err as Error).message }));

    store.register("FetchTodo", fetchTodo);

    await store.dispatch(fetchTodo, { id: 1 });

    // Effect ran exactly once (no silent auto-retry of the network call).
    expect(effectRuns).toBe(1);

    // onSuccess received the actual fetched payload.
    expect(receivedInOnSuccess).not.toBeNull();
    expect(receivedInOnSuccess!.id).toBe(1);

    // State reflects the fetched data end to end.
    expect(store.stateValue._tag).toBe("Loaded");
    const loaded = store.stateValue as Extract<TodoStateType, { _tag: "Loaded" }>;
    expect(loaded.id).toBe(1);
    expect(typeof loaded.title).toBe("string");
    expect(loaded.title.length).toBeGreaterThan(0);
  }, 15000);
});

describe("regression: middleware array passed by caller is not mutated", () => {
  it("does not reverse the caller's middlewares array in place", () => {
    const order: string[] = [];
    const mkMw =
      (label: string): Middleware<ApiStateType> =>
      () =>
      (next) =>
      (action) => {
        order.push(label);
        return next(action);
      };
    const a = mkMw("a");
    const b = mkMw("b");
    const middlewares = [a, b];

    createStore(ApiState.Idle({}), ApiState, { middlewares });

    // The caller's array must be untouched (a before b).
    expect(middlewares[0]).toBe(a);
    expect(middlewares[1]).toBe(b);

    // And a second store built from the same array sees the same execution order.
    const store2 = createStore(ApiState.Idle({}), ApiState, { middlewares });
    const inc = createAction<void, ApiStateType>("Noop")
      .withPayload(undefined)
      .withState((s) => s);
    store2.register("Noop", inc);
    order.length = 0;
    store2.dispatch("tagix/action/Noop", undefined);
    expect(order).toEqual(["a", "b"]);
  });
});
