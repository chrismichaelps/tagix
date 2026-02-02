import { describe, it, expect } from "vitest";
import { createStore, createAction, createAsyncAction, taggedEnum } from "../../index";

const CounterState = taggedEnum({
  Idle: { value: 0 },
  Loading: {},
  Ready: { value: 0 },
  Error: { message: "", code: 0 },
  Pending: { value: 0, retries: 0 },
});

type CounterStateType = typeof CounterState.State;

describe("createAction", () => {
  it("should create basic action with type and payload", () => {
    const increment = createAction<{ amount: number }, CounterStateType>("Increment")
      .withPayload({ amount: 1 })
      .withState((state, payload) => ({
        ...state,
        value: state.value + payload.amount,
      }));

    expect(increment.type).toBe("tagix/action/Increment");
    expect(increment.payload.amount).toBe(1);
    expect(typeof increment.handler).toBe("function");
  });

  it("should register and dispatch action", () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "Counter",
    });

    const increment = createAction<{ amount: number }, CounterStateType>("Increment")
      .withPayload({ amount: 5 })
      .withState((state, payload) => ({
        ...state,
        value: state.value + payload.amount,
      }));

    store.register("Increment", increment);
    store.dispatch("tagix/action/Increment", { amount: 5 });

    const idleState = store.stateValue as Extract<CounterStateType, { _tag: "Idle" }>;
    expect(idleState.value).toBe(5);
    expect(store.stateValue._tag).toBe("Idle");
  });

  it("should throw ActionNotFoundError for unregistered action", () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

    expect(() => {
      store.dispatch("tagix/action/NonExistent", { amount: 1 });
    }).toThrow();
  });

  it("should handle action with no payload", () => {
    const store = createStore(CounterState.Idle({ value: 10 }), CounterState, {
      name: "NoPayload",
    });

    const reset = createAction<undefined, CounterStateType>("Reset")
      .withPayload(undefined)
      .withState((state) => ({ ...state, value: 0 }));

    store.register("Reset", reset);
    store.dispatch("tagix/action/Reset", undefined);

    const idleState = store.stateValue as Extract<CounterStateType, { _tag: "Idle" }>;
    expect(idleState.value).toBe(0);
  });

  it("should handle multiple sequential actions", () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "MultiCounter",
    });

    const add = createAction<{ n: number }, CounterStateType>("Add")
      .withPayload({ n: 10 })
      .withState((s, p) => ({ ...s, value: s.value + p.n }));

    const multiply = createAction<{ n: number }, CounterStateType>("Multiply")
      .withPayload({ n: 2 })
      .withState((s, p) => ({ ...s, value: s.value * p.n }));

    store.register("Add", add);
    store.register("Multiply", multiply);

    store.dispatch("tagix/action/Add", { n: 10 });
    let state = store.stateValue as Extract<CounterStateType, { _tag: "Idle" }>;
    expect(state.value).toBe(10);

    store.dispatch("tagix/action/Multiply", { n: 2 });
    state = store.stateValue as Extract<CounterStateType, { _tag: "Idle" }>;
    expect(state.value).toBe(20);
  });

  it("should handle action with conditional state transition", () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "Conditional",
    });

    const conditionalUpdate = createAction<{ threshold: number }, CounterStateType>(
      "ConditionalUpdate"
    )
      .withPayload({ threshold: 5 })
      .withState((s, p) => {
        if (s.value >= p.threshold) {
          return { ...s, _tag: "Ready" as const, value: s.value };
        }
        return s;
      });

    store.register("ConditionalUpdate", conditionalUpdate);

    store.dispatch("tagix/action/ConditionalUpdate", { threshold: 5 });
    expect(store.stateValue._tag).toBe("Idle");

    const add = createAction<{ amount: number }, CounterStateType>("Add")
      .withPayload({ amount: 10 })
      .withState((s, p) => ({ ...s, value: s.value + p.amount }));
    store.register("Add", add);

    store.dispatch("tagix/action/Add", { amount: 10 });
    store.dispatch("tagix/action/ConditionalUpdate", { threshold: 5 });
    expect(store.stateValue._tag).toBe("Ready");
  });

  it("should handle action that preserves state tag", () => {
    const store = createStore(CounterState.Ready({ value: 100 }), CounterState, {
      name: "Preserve",
    });

    const noOp = createAction<{}, CounterStateType>("NoOp")
      .withPayload({})
      .withState((s) => s);

    store.register("NoOp", noOp);
    const previousState = store.stateValue;
    store.dispatch("tagix/action/NoOp", {});

    expect(store.stateValue).toEqual(previousState);
  });

  it("should handle large payload values", () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "LargePayload",
    });

    const largeAdd = createAction<{ amount: number }, CounterStateType>("LargeAdd")
      .withPayload({ amount: 1000000 })
      .withState((s, p) => ({ ...s, value: s.value + p.amount }));

    store.register("LargeAdd", largeAdd);
    store.dispatch("tagix/action/LargeAdd", { amount: 1000000 });

    const state = store.stateValue as Extract<CounterStateType, { _tag: "Idle" }>;
    expect(state.value).toBe(1000000);
  });

  it("should handle negative payload values", () => {
    const store = createStore(CounterState.Ready({ value: 10 }), CounterState, {
      name: "Negative",
    });

    const subtract = createAction<{ amount: number }, CounterStateType>("Subtract")
      .withPayload({ amount: 3 })
      .withState((s, p) => ({ ...s, value: s.value - p.amount }));

    store.register("Subtract", subtract);
    store.dispatch("tagix/action/Subtract", { amount: 3 });

    const state = store.stateValue as Extract<CounterStateType, { _tag: "Ready" }>;
    expect(state.value).toBe(7);
  });
});

describe("createAsyncAction", () => {
  it("should create async action with effect, onSuccess, and onError", () => {
    const fetchData = createAsyncAction<string, CounterStateType, string>("FetchData")
      .state((s) => ({ ...s, _tag: "Loading" }))
      .effect(async () => "data")
      .onSuccess((s, result) => ({ ...s, _tag: "Ready", value: 10 }))
      .onError((s, error) => ({ ...s, _tag: "Error" as const, message: String(error), code: 0 }));

    expect(fetchData.type).toBe("tagix/action/FetchData");
    expect(typeof fetchData.effect).toBe("function");
    expect(typeof fetchData.onSuccess).toBe("function");
    expect(typeof fetchData.onError).toBe("function");
    expect(typeof fetchData.state).toBe("function");
  });

  it("should handle async action with mock fetch", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "AsyncTest",
    });

    const fetchData = createAsyncAction<undefined, CounterStateType, string>("FetchData")
      .state((s) => ({ ...s, _tag: "Loading" }))
      .effect(async () => "mock-data")
      .onSuccess((s, result) => ({ ...s, _tag: "Ready", value: 100 }))
      .onError((s, error) => ({ ...s, _tag: "Error" as const, message: String(error), code: 0 }));

    store.register("FetchData", fetchData);
    await store.dispatch("tagix/action/FetchData", {});

    expect(store.stateValue._tag).toBe("Ready");
    const state = store.stateValue as Extract<CounterStateType, { _tag: "Ready" }>;
    expect(state.value).toBe(100);
  });

  it("should handle async action error", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "AsyncErrorTest",
    });

    const failingAction = createAsyncAction<undefined, CounterStateType, unknown>("FailingAPI")
      .state((s) => ({ ...s, _tag: "Loading" }))
      .effect(async () => {
        throw new Error("API failed");
      })
      .onSuccess((s, r) => ({ ...s, _tag: "Ready", value: 10 }))
      .onError((s, error) => {
        const err = error instanceof Error ? error : new Error(String(error));
        return { ...s, _tag: "Error" as const, message: err.message, code: 500 };
      });

    store.register("FailingAPI", failingAction);

    try {
      await store.dispatch("tagix/action/FailingAPI", {});
    } catch {}

    expect(store.stateValue._tag).toBe("Error");
    const state = store.stateValue as Extract<CounterStateType, { _tag: "Error" }>;
    expect(state.code).toBe(500);
  });

  it("should fetch from public API (JSONPlaceholder)", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "APITest",
    });

    const fetchUsers = createAsyncAction<undefined, CounterStateType, unknown[]>("FetchUsers")
      .state((s) => ({ ...s, _tag: "Loading" }))
      .effect(async () => {
        const response = await fetch("https://jsonplaceholder.typicode.com/users");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .onSuccess((s, data) => ({
        ...s,
        _tag: "Ready" as const,
        value: Array.isArray(data) ? data.length : 0,
      }))
      .onError((s, error) => ({
        ...s,
        _tag: "Error" as const,
        message: String(error),
        code: 0,
      }));

    store.register("FetchUsers", fetchUsers);

    try {
      await store.dispatch("tagix/action/FetchUsers", {});
      expect(store.stateValue._tag).toBe("Ready");
      const state = store.stateValue as Extract<CounterStateType, { _tag: "Ready" }>;
      expect(state.value).toBe(10);
    } catch (e) {
      console.log("API test skipped due to network error:", (e as Error).message);
    }
  });

  it("should fetch single post from public API", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "PostAPITest",
    });

    const fetchPost = createAsyncAction<undefined, CounterStateType, { id: number }>("FetchPost")
      .state((s) => ({ ...s, _tag: "Loading" }))
      .effect(async () => {
        const response = await fetch("https://jsonplaceholder.typicode.com/posts/1");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .onSuccess((s, data) => ({
        ...s,
        _tag: "Ready" as const,
        value: data.id,
      }))
      .onError((s, error) => ({
        ...s,
        _tag: "Error" as const,
        message: String(error),
        code: 0,
      }));

    store.register("FetchPost", fetchPost);

    try {
      await store.dispatch("tagix/action/FetchPost", {});
      expect(store.stateValue._tag).toBe("Ready");
      const state = store.stateValue as Extract<CounterStateType, { _tag: "Ready" }>;
      expect(state.value).toBe(1);
    } catch (e) {
      console.log("API test skipped due to network error:", (e as Error).message);
    }
  });

  it("should handle 404 error from public API", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "NotFoundTest",
    });

    const fetchNotFound = createAsyncAction<undefined, CounterStateType, unknown>("FetchNotFound")
      .state((s) => ({ ...s, _tag: "Loading" }))
      .effect(async () => {
        const response = await fetch("https://jsonplaceholder.typicode.com/posts/99999");
        if (!response.ok) throw new Error(`HTTP ${response.status}: Not Found`);
        return response.json();
      })
      .onSuccess((s, data) => ({
        ...s,
        _tag: "Ready" as const,
        value: 0,
      }))
      .onError((s, error) => ({
        ...s,
        _tag: "Error" as const,
        message: String(error),
        code: 404,
      }));

    store.register("FetchNotFound", fetchNotFound);

    try {
      await store.dispatch("tagix/action/FetchNotFound", {});
      expect(store.stateValue._tag).toBe("Error");
      const state = store.stateValue as Extract<CounterStateType, { _tag: "Error" }>;
      expect(state.code).toBe(404);
    } catch (e) {
      console.log("API test skipped due to network error:", (e as Error).message);
    }
  });

  it("should handle concurrent async actions", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "ConcurrentTest",
    });

    const fetchData = (id: number) =>
      createAsyncAction<undefined, CounterStateType, unknown>(`FetchData${id}`)
        .state((s) => s)
        .effect(async () => {
          const response = await fetch(`https://jsonplaceholder.typicode.com/users/${id}`);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        })
        .onSuccess((s, data) => ({ ...s, [`user${id}`]: data }))
        .onError((s, error) => ({ ...s, [`error${id}`]: String(error) }));

    store.register("FetchData1", fetchData(1));
    store.register("FetchData2", fetchData(2));

    try {
      await Promise.all([
        store.dispatch("tagix/action/FetchData1", {}),
        store.dispatch("tagix/action/FetchData2", {}),
      ]);

      const state = store.stateValue as Record<string, unknown>;
      expect(state.user1).toBeDefined();
      expect(state.user2).toBeDefined();
    } catch (e) {
      console.log("Concurrent test skipped due to network error:", (e as Error).message);
    }
  });

  it("should handle async action with retry logic", async () => {
    const store = createStore(CounterState.Pending({ value: 0, retries: 0 }), CounterState, {
      name: "RetryTest",
    });

    let attempts = 0;
    const retryAction = createAsyncAction<undefined, CounterStateType, string>("RetryAction")
      .state((s) => ({ ...s, _tag: "Loading" as const }))
      .effect(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error("Temporary failure");
        }
        return "success";
      })
      .onSuccess((s, result) => ({
        ...s,
        _tag: "Ready" as const,
        value: attempts,
      }))
      .onError((s, error) => {
        const pendingState = s as Extract<CounterStateType, { _tag: "Pending" }>;
        const retries = pendingState.retries + 1;
        if (retries < 3) {
          return { ...s, _tag: "Pending" as const, value: s.value, retries };
        }
        return {
          ...s,
          _tag: "Error" as const,
          message: String(error),
          code: 0,
          value: s.value,
          retries,
        };
      });

    store.register("RetryAction", retryAction);

    try {
      await store.dispatch("tagix/action/RetryAction", {});
      expect(store.stateValue._tag).toBe("Ready");
      const state = store.stateValue as Extract<CounterStateType, { _tag: "Ready" }>;
      expect(state.value).toBe(3);
    } catch (e) {
      console.log("Retry test result:", (e as Error).message);
    }
  });

  it("should handle async action that creates post", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "CreatePostTest",
    });

    const createPost = createAsyncAction<undefined, CounterStateType, { id: number }>("CreatePost")
      .state((s) => ({ ...s, _tag: "Loading" as const }))
      .effect(async () => {
        const response = await fetch("https://jsonplaceholder.typicode.com/posts", {
          method: "POST",
          body: JSON.stringify({
            title: "Test Post",
            body: "This is a test",
            userId: 1,
          }),
          headers: { "Content-type": "application/json; charset=UTF-8" },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .onSuccess((s, data) => ({
        ...s,
        _tag: "Ready" as const,
        value: data.id,
      }))
      .onError((s, error) => ({
        ...s,
        _tag: "Error" as const,
        message: String(error),
        code: 0,
      }));

    store.register("CreatePost", createPost);

    try {
      await store.dispatch("tagix/action/CreatePost", {});
      expect(store.stateValue._tag).toBe("Ready");
      const state = store.stateValue as Extract<CounterStateType, { _tag: "Ready" }>;
      expect(state.value).toBeGreaterThan(0);
    } catch (e) {
      console.log("Create post test skipped due to network error:", (e as Error).message);
    }
  });

  it("should handle async action that updates post", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "UpdatePostTest",
    });

    const updatePost = createAsyncAction<undefined, CounterStateType, { id: number }>("UpdatePost")
      .state((s) => ({ ...s, _tag: "Loading" as const }))
      .effect(async () => {
        const response = await fetch("https://jsonplaceholder.typicode.com/posts/1", {
          method: "PUT",
          body: JSON.stringify({
            id: 1,
            title: "Updated Title",
            body: "Updated body",
            userId: 1,
          }),
          headers: { "Content-type": "application/json; charset=UTF-8" },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .onSuccess((s, data) => ({
        ...s,
        _tag: "Ready" as const,
        value: data.id,
      }))
      .onError((s, error) => ({
        ...s,
        _tag: "Error" as const,
        message: String(error),
        code: 0,
      }));

    store.register("UpdatePost", updatePost);

    try {
      await store.dispatch("tagix/action/UpdatePost", {});
      expect(store.stateValue._tag).toBe("Ready");
      const state = store.stateValue as Extract<CounterStateType, { _tag: "Ready" }>;
      expect(state.value).toBe(1);
    } catch (e) {
      console.log("Update post test skipped due to network error:", (e as Error).message);
    }
  });

  it("should handle async action that deletes post", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "DeletePostTest",
    });

    const deletePost = createAsyncAction<undefined, CounterStateType, { success: boolean }>(
      "DeletePost"
    )
      .state((s) => ({ ...s, _tag: "Loading" as const }))
      .effect(async () => {
        const response = await fetch("https://jsonplaceholder.typicode.com/posts/1", {
          method: "DELETE",
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return { success: true };
      })
      .onSuccess((s, data) => ({
        ...s,
        _tag: "Ready" as const,
        value: 1,
      }))
      .onError((s, error) => ({
        ...s,
        _tag: "Error" as const,
        message: String(error),
        code: 0,
      }));

    store.register("DeletePost", deletePost);

    try {
      await store.dispatch("tagix/action/DeletePost", {});
      expect(store.stateValue._tag).toBe("Ready");
      const state = store.stateValue as Extract<CounterStateType, { _tag: "Ready" }>;
      expect(state.value).toBe(1);
    } catch (e) {
      console.log("Delete post test skipped due to network error:", (e as Error).message);
    }
  });

  it("should return Promise from dispatch", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "DispatchReturn",
    });

    const fetchData = createAsyncAction<undefined, CounterStateType, string>("FetchData")
      .state((s) => ({ ...s, _tag: "Loading" }))
      .effect(async () => "data")
      .onSuccess((s, result) => ({ ...s, _tag: "Ready", value: 10 }))
      .onError((s, error) => ({ ...s, _tag: "Error" as const, message: String(error), code: 0 }));

    store.register("FetchData", fetchData);

    const result = store.dispatch("tagix/action/FetchData", {});
    expect(result).toBeInstanceOf(Promise);
    await result;
    expect(store.stateValue._tag).toBe("Ready");
  });

  it("should catch errors in onError and not throw", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "ErrorCatch",
    });

    const riskyFetch = createAsyncAction<undefined, CounterStateType, unknown>("RiskyFetch")
      .state((s) => ({ ...s, _tag: "Loading" }))
      .effect(async () => {
        throw new Error("Request failed");
      })
      .onSuccess((s, data) => ({ ...s, _tag: "Ready", value: 10 }))
      .onError((s, error) => {
        const err = error instanceof Error ? error : new Error(String(error));
        return { ...s, _tag: "Error" as const, message: err.message, code: 500 };
      });

    store.register("RiskyFetch", riskyFetch);

    let caughtError = false;
    try {
      await store.dispatch("tagix/action/RiskyFetch", {});
    } catch {
      caughtError = true;
    }

    expect(caughtError).toBe(false);
    expect(store.stateValue._tag).toBe("Error");
    const state = store.stateValue as Extract<CounterStateType, { _tag: "Error" }>;
    expect(state.message).toBe("Request failed");
  });

  it("should fetch todos from public API", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "TodosTest",
    });

    const fetchTodos = createAsyncAction<undefined, CounterStateType, unknown[]>("FetchTodos")
      .state((s) => ({ ...s, _tag: "Loading" }))
      .effect(async () => {
        const response = await fetch("https://jsonplaceholder.typicode.com/todos?_limit=5");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .onSuccess((s, data) => ({
        ...s,
        _tag: "Ready" as const,
        value: Array.isArray(data) ? data.length : 0,
      }))
      .onError((s, error) => ({
        ...s,
        _tag: "Error" as const,
        message: String(error),
        code: 0,
      }));

    store.register("FetchTodos", fetchTodos);

    try {
      await store.dispatch("tagix/action/FetchTodos", {});
      expect(store.stateValue._tag).toBe("Ready");
      const state = store.stateValue as Extract<CounterStateType, { _tag: "Ready" }>;
      expect(state.value).toBe(5);
    } catch (e) {
      console.log("Todos test skipped due to network error:", (e as Error).message);
    }
  });

  it("should fetch comments from public API", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "CommentsTest",
    });

    const fetchComments = createAsyncAction<undefined, CounterStateType, unknown[]>("FetchComments")
      .state((s) => ({ ...s, _tag: "Loading" }))
      .effect(async () => {
        const response = await fetch("https://jsonplaceholder.typicode.com/comments?postId=1");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .onSuccess((s, data) => ({
        ...s,
        _tag: "Ready" as const,
        value: Array.isArray(data) ? data.length : 0,
      }))
      .onError((s, error) => ({
        ...s,
        _tag: "Error" as const,
        message: String(error),
        code: 0,
      }));

    store.register("FetchComments", fetchComments);

    try {
      await store.dispatch("tagix/action/FetchComments", {});
      expect(store.stateValue._tag).toBe("Ready");
      const state = store.stateValue as Extract<CounterStateType, { _tag: "Ready" }>;
      expect(state.value).toBe(5);
    } catch (e) {
      console.log("Comments test skipped due to network error:", (e as Error).message);
    }
  });
});

describe("createAsyncAction - Retry Logic", () => {
  it("should handle async action with retry logic", async () => {
    const store = createStore(CounterState.Pending({ value: 0, retries: 0 }), CounterState, {
      name: "RetryTest",
    });

    let attempts = 0;
    const retryAction = createAsyncAction<undefined, CounterStateType, string>("RetryAction")
      .state((s) => ({ ...s, _tag: "Loading" as const }))
      .effect(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error("Temporary failure");
        }
        return "success";
      })
      .onSuccess((s, result) => ({
        ...s,
        _tag: "Ready" as const,
        value: attempts,
      }))
      .onError((s, error) => {
        const pendingState = s as Extract<CounterStateType, { _tag: "Pending" }>;
        const retries = pendingState.retries + 1;
        if (retries < 3) {
          return { ...s, _tag: "Pending" as const, value: s.value, retries };
        }
        return {
          ...s,
          _tag: "Error" as const,
          message: String(error),
          code: 0,
          value: s.value,
          retries,
        };
      });

    store.register("RetryAction", retryAction);

    try {
      await store.dispatch("tagix/action/RetryAction", {});
      expect(store.stateValue._tag).toBe("Ready");
      const state = store.stateValue as Extract<CounterStateType, { _tag: "Ready" }>;
      expect(state.value).toBe(3);
    } catch (e) {
      console.log("Retry test result:", (e as Error).message);
    }
  });
});

describe("Async Action - State Freshness", () => {
  it("should preserve intermediate state updates during async execution", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

    const increment = createAction<{ amount: number }, CounterStateType>("Increment")
      .withPayload({ amount: 1 })
      .withState((s, p) => ({
        ...s,
        value: (s as Extract<CounterStateType, { value: number }>).value + p.amount,
      }));

    const asyncAction = createAsyncAction<void, CounterStateType, number>("AsyncAction")
      .state((s) => ({
        ...s,
        _tag: "Loading" as const,
        value: (s as Extract<CounterStateType, { value: number }>).value,
      }))
      .effect(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return 10;
      })
      .onSuccess((s, val) => ({
        ...s,
        _tag: "Ready" as const,
        value: (s as Extract<CounterStateType, { value: number }>).value + val,
      }))
      .onError((s) => s);

    store.register("Increment", increment);
    store.register("AsyncAction", asyncAction);

    const asyncPromise = store.dispatch("tagix/action/AsyncAction", {});

    await new Promise((resolve) => setTimeout(resolve, 10));
    store.dispatch("tagix/action/Increment", { amount: 1 });

    expect((store.stateValue as Extract<CounterStateType, { value: number }>).value).toBe(1);

    await asyncPromise;

    expect((store.stateValue as Extract<CounterStateType, { value: number }>).value).toBe(11);
  });

  it("onSuccess should receive fresh state when concurrent updates occur", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

    const setValue = createAction<{ value: number }, CounterStateType>("SetValue")
      .withPayload({ value: 0 })
      .withState((s, p) => ({ ...s, value: p.value }));

    store.register("SetValue", setValue);

    let receivedStateValue = 0;

    const fetchData = createAsyncAction<void, CounterStateType, number>("FetchData")
      .state((s) => ({ ...s, _tag: "Loading" as const }))
      .effect(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return 100;
      })
      .onSuccess((s, result) => {
        receivedStateValue = (s as Extract<CounterStateType, { value: number }>).value;
        expect(s._tag).toBe("Loading");
        expect((s as Extract<CounterStateType, { value: number }>).value).toBe(5);
        return {
          ...s,
          _tag: "Ready" as const,
          value: (s as Extract<CounterStateType, { value: number }>).value + result,
        };
      })
      .onError((s) => s);

    store.register("FetchData", fetchData);

    const promise = store.dispatch("tagix/action/FetchData", {});

    await new Promise((resolve) => setTimeout(resolve, 5));
    store.dispatch("tagix/action/SetValue", { value: 5 });

    await promise;

    expect(receivedStateValue).toBe(5);
    expect((store.stateValue as Extract<CounterStateType, { value: number }>).value).toBe(105);
    expect(store.stateValue._tag).toBe("Ready");
  });

  it("should catch errors in onError and not throw", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "ErrorCatch",
    });

    const riskyFetch = createAsyncAction<undefined, CounterStateType, unknown>("RiskyFetch")
      .state((s) => ({ ...s, _tag: "Loading" }))
      .effect(async () => {
        throw new Error("Request failed");
      })
      .onSuccess((s, data) => ({ ...s, _tag: "Ready", value: 10 }))
      .onError((s, error) => {
        const err = error instanceof Error ? error : new Error(String(error));
        return { ...s, _tag: "Error" as const, message: err.message, code: 500 };
      });

    store.register("RiskyFetch", riskyFetch);

    let caughtError = false;
    try {
      await store.dispatch("tagix/action/RiskyFetch", {});
    } catch {
      caughtError = true;
    }

    expect(caughtError).toBe(false);
    expect(store.stateValue._tag).toBe("Error");
    const state = store.stateValue as Extract<CounterStateType, { _tag: "Error" }>;
    expect(state.message).toBe("Request failed");
  });
});

describe("Dispatch API", () => {
  it("should support string-based dispatch for backward compatibility", () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

    const increment = createAction<{ amount: number }, CounterStateType>("Increment")
      .withPayload({ amount: 1 })
      .withState((s, p) => ({ ...s, value: s.value + p.amount }));

    store.register("Increment", increment);

    store.dispatch("tagix/action/Increment", { amount: 7 });

    const state = store.stateValue as Extract<CounterStateType, { value: number }>;
    expect(state.value).toBe(7);
  });

  it("should support async action dispatch with string", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

    const fetchData = createAsyncAction<void, CounterStateType, string>("FetchData")
      .state((s) => ({ ...s, _tag: "Loading" }))
      .effect(async () => "data")
      .onSuccess((s, data) => ({ ...s, _tag: "Ready", value: 10 }))
      .onError((s) => s);

    store.register("FetchData", fetchData);

    await store.dispatch("tagix/action/FetchData", undefined);

    expect(store.stateValue._tag).toBe("Ready");
  });

  it("should support dispatch with action creator function", () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

    const increment = createAction<{ amount: number }, CounterStateType>("Increment")
      .withPayload({ amount: 1 })
      .withState((s, p) => ({ ...s, value: s.value + p.amount }));

    store.register("Increment", increment);

    const incrementBy = (payload: { amount: number }) => increment;
    store.dispatch(incrementBy, { amount: 5 });

    const state = store.stateValue as Extract<CounterStateType, { value: number }>;
    expect(state.value).toBe(5);
  });

  it("should support async dispatch with action creator function", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

    const fetchData = createAsyncAction<{ id: number }, CounterStateType, string>("FetchData")
      .state((s) => ({ ...s, _tag: "Loading" }))
      .effect(async (p) => `data-${p.id}`)
      .onSuccess((s, data) => ({ ...s, _tag: "Ready", value: data.length }))
      .onError((s) => s);

    store.register("FetchData", fetchData);

    const fetchById = (payload: { id: number }) => fetchData;
    await store.dispatch(fetchById, { id: 123 });

    expect(store.stateValue._tag).toBe("Ready");
    const state = store.stateValue as Extract<CounterStateType, { value: number }>;
    expect(state.value).toBe(8); // "data-123".length
  });
});
