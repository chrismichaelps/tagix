import { describe, it, expect } from "vitest";
import {
  createStore,
  createAction,
  createAsyncAction,
  fork,
  taggedEnum,
  ERROR_CODES,
} from "../../index";
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
        return {
          id: payload.id,
          title: "local todo",
          completed: false,
        };
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
  });
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

describe("regression: core state transitions", () => {
  it("passes payload through store transition helpers", () => {
    const store = createStore(ApiState.Success({ data: 1 }), ApiState);

    const transition = store.transitions({
      Success: (state, payload) =>
        state._tag === "Success"
          ? ApiState.Success({ data: state.data + (payload as { amount: number }).amount })
          : state,
    });

    expect(transition(store.stateValue, { amount: 4 })).toEqual(ApiState.Success({ data: 5 }));
  });

  it("enforces strict state tags for async pending states", async () => {
    const store = createStore(ApiState.Idle({}), ApiState, { strict: true });
    const action = createAsyncAction<void, ApiStateType, number>("InvalidPending")
      .state(() => ({ _tag: "Missing" }) as unknown as ApiStateType)
      .effect(async () => 1)
      .onSuccess(() => ApiState.Success({ data: 1 }))
      .onError((s) => s);

    store.register("InvalidPending", action);

    await expect(store.dispatch("InvalidPending", undefined)).rejects.toMatchObject({
      _tag: "StateTransitionError",
    });
  });

  it("enforces strict state tags for async success states", async () => {
    const store = createStore(ApiState.Idle({}), ApiState, { strict: true });
    const action = createAsyncAction<void, ApiStateType, number>("InvalidSuccess")
      .state(() => ApiState.Loading({}))
      .effect(async () => 1)
      .onSuccess(() => ({ _tag: "Missing" }) as unknown as ApiStateType)
      .onError((s) => s);

    store.register("InvalidSuccess", action);

    await expect(store.dispatch("InvalidSuccess", undefined)).rejects.toMatchObject({
      _tag: "StateTransitionError",
    });
  });

  it("preserves opt-in retry behavior when a store is forked", async () => {
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
    const forked = fork(store);

    await forked.dispatch("Create", undefined);

    expect(runs).toBe(1);
    expect(forked.stateValue._tag).toBe("Error");
  });

  it("attaches error codes so store error helpers work", () => {
    const store = createStore(ApiState.Idle({}), ApiState);
    const action = createAction<void, ApiStateType>("Fail")
      .withPayload(undefined)
      .withState(() => {
        throw new Error("plain failure");
      });

    store.register("Fail", action);
    store.dispatch("Fail", undefined);

    expect(store.lastErrorCode).toBeUndefined();

    expect(() => store.dispatch("Missing", undefined)).toThrow();
    expect(store.lastErrorCode).toBe(ERROR_CODES.ACTION_NOT_FOUND);
    expect(store.hasErrorCode(ERROR_CODES.ACTION_NOT_FOUND)).toBe(true);

    const strictStore = createStore(ApiState.Idle({}), ApiState, { strict: true });
    const invalid = createAction<void, ApiStateType>("Invalid")
      .withPayload(undefined)
      .withState(() => ({ _tag: "Missing" }) as unknown as ApiStateType);
    strictStore.register("Invalid", invalid);

    expect(() => strictStore.dispatch("Invalid", undefined)).toThrow();
    expect(strictStore.lastErrorCode).toBe(ERROR_CODES.STATE_TRANSITION);
    expect(strictStore.hasErrorCode(ERROR_CODES.STATE_TRANSITION)).toBe(true);
    expect(strictStore.lastErrorCategory).toBe("STATE");
  });
});

describe("regression: re-entrant subscriber dispatch must not recurse unboundedly", () => {
  it("defers a subscriber's synchronous dispatch instead of recursing into the stack", () => {
    const store = createStore(ApiState.Success({ data: 0 }), ApiState);

    const increment = createAction<void, ApiStateType>("Increment")
      .withPayload(undefined)
      .withState((s) =>
        s._tag === "Success" ? ApiState.Success({ data: s.data + 1 }) : s
      );
    store.register("Increment", increment);

    // An unconditionally-dispatching subscriber. Before the fix this recursed
    // ~690 frames deep until the JS engine threw a RangeError, which notify's
    // try/catch silently swallowed — so dispatch "succeeded" while error
    // history was polluted with a hidden stack overflow.
    let seen = 0;
    let depth = 0;
    let maxDepth = 0;
    store.subscribe(() => {
      depth++;
      maxDepth = Math.max(maxDepth, depth);
      seen++;
      if (seen <= 20) store.dispatch("Increment", undefined);
      depth--;
    });

    store.dispatch("Increment", undefined);

    // All 20 chained dispatches were delivered (state advanced by them)…
    expect(store.stateValue._tag === "Success" ? store.stateValue.data : 0).toBeGreaterThanOrEqual(20);
    // …but the notification stack stayed shallow — no deep recursion.
    expect(maxDepth).toBeLessThan(20);
    // And no swallowed RangeError lurks in error history.
    const messages = store.errorHistory.map((e) =>
      e instanceof Error ? e.message : String(e)
    );
    expect(messages.some((m) => /maximum call stack/i.test(m))).toBe(false);
  });
});
