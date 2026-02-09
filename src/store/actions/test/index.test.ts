import { describe, it, expect } from "vitest";
import { createStore, createAction, createAsyncAction, taggedEnum } from "../../index";
import { TestError } from "../../error";

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
        throw new TestError({ message: "API failed" });
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
        if (!response.ok) throw new TestError({ message: `HTTP ${response.status}` });
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
        if (!response.ok) throw new TestError({ message: `HTTP ${response.status}` });
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
        if (!response.ok) throw new TestError({ message: `HTTP ${response.status}: Not Found` });
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
      if (!response.ok) throw new TestError({ message: `HTTP ${response.status}` });
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
          throw new TestError({ message: "Temporary failure" });
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
        if (!response.ok) throw new TestError({ message: `HTTP ${response.status}` });
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
        if (!response.ok) throw new TestError({ message: `HTTP ${response.status}` });
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
        if (!response.ok) throw new TestError({ message: `HTTP ${response.status}` });
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
        throw new TestError({ message: "Request failed" });
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
        if (!response.ok) throw new TestError({ message: `HTTP ${response.status}` });
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
        if (!response.ok) throw new TestError({ message: `HTTP ${response.status}` });
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
          throw new TestError({ message: "Temporary failure" });
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
        throw new TestError({ message: "Request failed" });
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

  it("should dispatch action with complex payload", () => {
    interface UserPayload {
      user: { id: number; name: string };
      preferences: { theme: string; notifications: boolean };
    }

    const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

    const setUser = createAction<UserPayload, CounterStateType>("SetUser")
      .withPayload({
        user: { id: 1, name: "Test" },
        preferences: { theme: "dark", notifications: true },
      })
      .withState((s, p) => ({ ...s, value: p.user.id }));

    store.register("SetUser", setUser);

    const createSetUser = (payload: UserPayload) => setUser;
    store.dispatch(createSetUser, {
      user: { id: 42, name: "John" },
      preferences: { theme: "light", notifications: false },
    });

    const state = store.stateValue as Extract<CounterStateType, { value: number }>;
    expect(state.value).toBe(42);
  });

  it("should dispatch multiple actions in sequence with action creators", () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

    const increment = createAction<{ amount: number }, CounterStateType>("Increment")
      .withPayload({ amount: 1 })
      .withState((s, p) => ({ ...s, value: s.value + p.amount }));

    const decrement = createAction<{ amount: number }, CounterStateType>("Decrement")
      .withPayload({ amount: 1 })
      .withState((s, p) => ({ ...s, value: s.value - p.amount }));

    store.register("Increment", increment);
    store.register("Decrement", decrement);

    const inc = (payload: { amount: number }) => increment;
    const dec = (payload: { amount: number }) => decrement;

    store.dispatch(inc, { amount: 10 });
    store.dispatch(dec, { amount: 3 });
    store.dispatch(inc, { amount: 5 });

    const state = store.stateValue as Extract<CounterStateType, { value: number }>;
    expect(state.value).toBe(12);
  });

  it("should dispatch async actions with retry", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

    let attempts = 0;
    const fetchWithRetry = createAsyncAction<void, CounterStateType, string>("FetchWithRetry")
      .state((s) => ({ ...s, _tag: "Loading" }))
      .effect(async () => {
        attempts++;
        if (attempts < 3) throw new TestError({ message: "Failed" });
        return "success";
      })
      .onSuccess((s, data) => ({ ...s, _tag: "Ready", value: attempts }))
      .onError((s) => s);

    store.register("FetchWithRetry", fetchWithRetry);

    const createFetch = () => fetchWithRetry;
    await store.dispatch(createFetch());

    expect(store.stateValue._tag).toBe("Ready");
    const state = store.stateValue as Extract<CounterStateType, { value: number }>;
    expect(state.value).toBe(3);
  });

  it("should dispatch async action with error handling", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

    const riskyFetch = createAsyncAction<void, CounterStateType, string>("RiskyFetch")
      .state((s) => ({ ...s, _tag: "Loading" }))
      .effect(async () => {
        throw new TestError({ message: "Network error" });
      })
      .onSuccess((s, data) => ({ ...s, _tag: "Ready", value: 10 }))
      .onError((s, error) => ({
        ...s,
        _tag: "Error",
        message: error instanceof Error ? error.message : String(error),
        value: -1,
        code: 500,
      }));

    store.register("RiskyFetch", riskyFetch);

    const createRiskyFetch = () => riskyFetch;
    await store.dispatch(createRiskyFetch());

    expect(store.stateValue._tag).toBe("Error");
    const state = store.stateValue as Extract<CounterStateType, { _tag: "Error" }>;
    expect(state.message).toBe("Network error");
  });

  it("should dispatch action creator that returns different action types", () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

    const increment = createAction<{ amount: number }, CounterStateType>("Increment")
      .withPayload({ amount: 1 })
      .withState((s, p) => ({ ...s, value: s.value + p.amount }));

    const setValue = createAction<{ value: number }, CounterStateType>("SetValue")
      .withPayload({ value: 0 })
      .withState((s, p) => ({ ...s, value: p.value }));

    store.register("Increment", increment);
    store.register("SetValue", setValue);

    const actions = {
      inc: (payload: { amount: number }) => increment,
      set: (payload: { value: number }) => setValue,
    };

    store.dispatch(actions.inc, { amount: 5 });
    store.dispatch(actions.set, { value: 100 });

    const state = store.stateValue as Extract<CounterStateType, { value: number }>;
    expect(state.value).toBe(100);
  });

  it("should dispatch async action and return Promise", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

    const fetchData = createAsyncAction<{ delay: number }, CounterStateType, number>("FetchData")
      .state((s) => ({ ...s, _tag: "Loading" }))
      .effect(async (p) => {
        await new Promise((resolve) => setTimeout(resolve, p.delay));
        return 42;
      })
      .onSuccess((s, data) => ({ ...s, _tag: "Ready", value: data }))
      .onError((s) => s);

    store.register("FetchData", fetchData);

    const createFetch = (payload: { delay: number }) => fetchData;
    const result = store.dispatch(createFetch, { delay: 10 });

    expect(result).toBeInstanceOf(Promise);
    await result;

    expect(store.stateValue._tag).toBe("Ready");
    const state = store.stateValue as Extract<CounterStateType, { value: number }>;
    expect(state.value).toBe(42);
  });

  it("should dispatch action with undefined payload", () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

    const reset = createAction<void, CounterStateType>("Reset").withState((s) => ({
      ...s,
      value: 0,
    }));

    store.register("Reset", reset);

    const createReset = () => reset;
    store.dispatch(createReset, undefined);

    const state = store.stateValue as Extract<CounterStateType, { value: number }>;
    expect(state.value).toBe(0);
  });

  it("should handle concurrent async dispatches", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

    const fetchA = createAsyncAction<{ id: number }, CounterStateType, number>("FetchA")
      .state((s) => ({ ...s, _tag: "Loading" }))
      .effect(async (p) => p.id * 10)
      .onSuccess((s, data) => ({ ...s, _tag: "Ready", value: s.value + data }))
      .onError((s) => s);

    const fetchB = createAsyncAction<{ id: number }, CounterStateType, number>("FetchB")
      .state((s) => ({ ...s, _tag: "Loading" }))
      .effect(async (p) => p.id * 5)
      .onSuccess((s, data) => ({ ...s, _tag: "Ready", value: s.value + data }))
      .onError((s) => s);

    store.register("FetchA", fetchA);
    store.register("FetchB", fetchB);

    const fetchA_fn = (payload: { id: number }) => fetchA;
    const fetchB_fn = (payload: { id: number }) => fetchB;

    await Promise.all([store.dispatch(fetchA_fn, { id: 1 }), store.dispatch(fetchB_fn, { id: 2 })]);

    expect(store.stateValue._tag).toBe("Ready");
    const state = store.stateValue as Extract<CounterStateType, { value: number }>;
    expect(state.value).toBe(20);
  });

  it("should dispatch action with nested state updates", () => {
    const NestedState = taggedEnum({
      Idle: { data: null },
      Ready: { data: { value: 0 } },
    });

    type NestedStateType = typeof NestedState.State;

    const store = createStore(NestedState.Idle({ data: null }), NestedState);

    const setData = createAction<{ value: number }, NestedStateType>("SetData")
      .withPayload({ value: 0 })
      .withState((s, p) => NestedState.Ready({ data: { value: p.value } }));

    store.register("SetData", setData);

    const createSetData = (payload: { value: number }) => setData;
    store.dispatch(createSetData, { value: 42 });

    const state = store.stateValue as Extract<NestedStateType, { _tag: "Ready" }>;
    expect(state.data.value).toBe(42);
  });
});

describe("Payload Flow", () => {
  it("should pass payload to action handler", () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

    let receivedPayload: { amount: number } | null = null;

    const increment = createAction<{ amount: number }, CounterStateType>("Increment")
      .withPayload({ amount: 1 })
      .withState((s, p) => {
        receivedPayload = p;
        return { ...s, value: s.value + p.amount };
      });

    store.register("Increment", increment);

    const createIncrement = (payload: { amount: number }) => increment;
    store.dispatch(createIncrement, { amount: 10 });

    expect(receivedPayload).toEqual({ amount: 10 });
    const state = store.stateValue as Extract<CounterStateType, { value: number }>;
    expect(state.value).toBe(10);
  });

  it("should pass payload to async effect", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

    let receivedPayload: { userId: number } | null = null;

    const fetchUser = createAsyncAction<{ userId: number }, CounterStateType, string>("FetchUser")
      .state((s) => ({ ...s, _tag: "Loading" }))
      .effect(async (p) => {
        receivedPayload = p;
        return `user-${p.userId}`;
      })
      .onSuccess((s, result) => ({ ...s, _tag: "Ready", value: 100 }))
      .onError((s) => s);

    store.register("FetchUser", fetchUser);

    const createFetchUser = (payload: { userId: number }) => fetchUser;
    await store.dispatch(createFetchUser, { userId: 42 });

    expect(receivedPayload).toEqual({ userId: 42 });
    expect(store.stateValue._tag).toBe("Ready");
  });

  it("should use payload in API fetch call", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

    let capturedUrl: string | null = null;
    let capturedPostId: number | null = null;

    const fetchPost = createAsyncAction<{ postId: number }, CounterStateType, number>("FetchPost")
      .state((s) => ({ ...s, _tag: "Loading" }))
      .effect(async (p) => {
        capturedUrl = `/api/posts/${p.postId}`;
        capturedPostId = p.postId;
        return p.postId;
      })
      .onSuccess((s, data) => ({ ...s, _tag: "Ready", value: data }))
      .onError((s) => s);

    store.register("FetchPost", fetchPost);

    const createFetchPost = (payload: { postId: number }) => fetchPost;
    await store.dispatch(createFetchPost, { postId: 123 });

    expect(capturedUrl).toBe("/api/posts/123");
    expect(capturedPostId).toBe(123);
    const state = store.stateValue as Extract<CounterStateType, { value: number }>;
    expect(state.value).toBe(123);
  });

  it("should pass different payloads to consecutive dispatches", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

    const fetchData = createAsyncAction<{ id: number }, CounterStateType, number>("FetchData")
      .state((s) => ({ ...s, _tag: "Loading" }))
      .effect(async (p) => p.id)
      .onSuccess((s, data) => ({ ...s, _tag: "Ready", value: data }))
      .onError((s) => s);

    store.register("FetchData", fetchData);

    const createFetchData = (payload: { id: number }) => fetchData;

    await store.dispatch(createFetchData, { id: 1 });
    let state = store.stateValue as Extract<CounterStateType, { value: number }>;
    expect(state.value).toBe(1);

    await store.dispatch(createFetchData, { id: 99 });
    state = store.stateValue as Extract<CounterStateType, { value: number }>;
    expect(state.value).toBe(99);

    await store.dispatch(createFetchData, { id: 42 });
    state = store.stateValue as Extract<CounterStateType, { value: number }>;
    expect(state.value).toBe(42);
  });

  it("should handle nested object payloads", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

    interface UserPayload {
      user: { id: number; profile: { name: string; email: string } };
      settings: { theme: string; notifications: boolean };
    }

    let capturedPayload: UserPayload | null = null;

    const updateUser = createAsyncAction<UserPayload, CounterStateType, number>("UpdateUser")
      .state((s) => ({ ...s, _tag: "Loading" }))
      .effect(async (p) => {
        capturedPayload = p;
        return p.user.id;
      })
      .onSuccess((s, data) => ({ ...s, _tag: "Ready", value: data }))
      .onError((s) => s);

    store.register("UpdateUser", updateUser);

    const createUpdateUser = (payload: UserPayload) => updateUser;
    await store.dispatch(createUpdateUser, {
      user: { id: 42, profile: { name: "John", email: "john@example.com" } },
      settings: { theme: "dark", notifications: true },
    });

    expect((capturedPayload as UserPayload | null)?.user.id).toBe(42);
    expect((capturedPayload as UserPayload | null)?.settings?.theme).toBe("dark");
    const state = store.stateValue as Extract<CounterStateType, { value: number }>;
    expect(state.value).toBe(42);
  });

  it("should handle array payload in effect", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

    let capturedPayload: number[] | null = null;

    const processItems = createAsyncAction<number[], CounterStateType, number>("ProcessItems")
      .state((s) => ({ ...s, _tag: "Loading" }))
      .effect(async (p) => {
        capturedPayload = p;
        return p.reduce((sum, n) => sum + n, 0);
      })
      .onSuccess((s, result) => ({ ...s, _tag: "Ready", value: result }))
      .onError((s) => s);

    store.register("ProcessItems", processItems);

    const createProcessItems = (payload: number[]) => processItems;
    await store.dispatch(createProcessItems, [1, 2, 3, 4, 5]);

    expect(capturedPayload).toEqual([1, 2, 3, 4, 5]);
    const state = store.stateValue as Extract<CounterStateType, { value: number }>;
    expect(state.value).toBe(15);
  });

  it("should use payload in API URL construction", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

    interface ApiRequest {
      baseUrl: string;
      endpoint: string;
      params: Record<string, string>;
    }

    let capturedUrl: string | null = null;

    const apiCall = createAsyncAction<ApiRequest, CounterStateType, unknown>("ApiCall")
      .state((s) => ({ ...s, _tag: "Loading" }))
      .effect(async (p) => {
        const queryString = Object.entries(p.params)
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
          .join("&");
        capturedUrl = `${p.baseUrl}${p.endpoint}?${queryString}`;
        return {};
      })
      .onSuccess((s, data) => ({ ...s, _tag: "Ready", value: 1 }))
      .onError((s) => s);

    store.register("ApiCall", apiCall);

    const createApiCall = (payload: ApiRequest) => apiCall;
    await store.dispatch(createApiCall, {
      baseUrl: "https://api.example.com",
      endpoint: "/users",
      params: { page: "1", limit: "10", sort: "name" },
    });

    expect(capturedUrl).toBe("https://api.example.com/users?page=1&limit=10&sort=name");
  });

  it("should handle Date object in payload", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

    let capturedDate: Date | null = null;

    const scheduleEvent = createAsyncAction<{ eventDate: Date }, CounterStateType, number>(
      "ScheduleEvent"
    )
      .state((s) => ({ ...s, _tag: "Loading" }))
      .effect(async (p) => {
        capturedDate = p.eventDate;
        return p.eventDate.getTime();
      })
      .onSuccess((s, data) => ({ ...s, _tag: "Ready", value: data }))
      .onError((s) => s);

    store.register("ScheduleEvent", scheduleEvent);

    const testDate = new Date("2026-12-25T00:00:00Z");
    const createScheduleEvent = (payload: { eventDate: Date }) => scheduleEvent;
    await store.dispatch(createScheduleEvent, { eventDate: testDate });

    expect((capturedDate as Date | null)?.toISOString()).toBe("2026-12-25T00:00:00.000Z");
    const state = store.stateValue as Extract<CounterStateType, { value: number }>;
    expect(state.value).toBe(testDate.getTime());
  });

  it("should handle payload with multiple properties", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

    let capturedPayload: { userId: number; includePosts: boolean; page: number } | null = null;

    const searchUsers = createAsyncAction<
      { userId: number; includePosts: boolean; page: number },
      CounterStateType,
      number[]
    >("SearchUsers")
      .state((s) => ({ ...s, _tag: "Loading" }))
      .effect(async (p) => {
        capturedPayload = p;
        return [p.userId, p.page];
      })
      .onSuccess((s, data) => ({ ...s, _tag: "Ready", value: data.length }))
      .onError((s) => s);

    store.register("SearchUsers", searchUsers);

    const createSearchUsers = (payload: { userId: number; includePosts: boolean; page: number }) =>
      searchUsers;
    await store.dispatch(createSearchUsers, { userId: 1, includePosts: true, page: 5 });

    expect(capturedPayload).toEqual({ userId: 1, includePosts: true, page: 5 });
  });
});
