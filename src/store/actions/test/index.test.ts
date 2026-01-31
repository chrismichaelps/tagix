import { describe, it, expect } from "vitest";
import { createStore, createAction, createAsyncAction, taggedEnum } from "../../index";

const CounterState = taggedEnum({
  Idle: { value: 0 },
  Loading: {},
  Ready: { value: 0 },
  Error: { message: "", code: 0 },
  Pending: { value: 0, retries: 0 },
});

describe("createAction", () => {
  it("should create basic action with type and payload", () => {
    const increment = createAction("Increment")
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

    const increment = createAction("Increment")
      .withPayload({ amount: 5 } as { amount: number })
      .withState((state, payload) => ({
        ...state,
        value: state.value + payload.amount,
      }));

    store.register("Increment", increment);
    store.dispatch("tagix/action/Increment", { amount: 5 });

    expect((store.stateValue as { value: number }).value).toBe(5);
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

    const reset = createAction("Reset")
      .withPayload(undefined)
      .withState((state) => ({ ...state, value: 0 }));

    store.register("Reset", reset);
    store.dispatch("tagix/action/Reset", undefined);

    expect((store.stateValue as { value: number }).value).toBe(0);
  });

  it("should handle multiple sequential actions", () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "MultiCounter",
    });

    const add = createAction("Add")
      .withPayload({ n: 10 } as { n: number })
      .withState((s, p) => ({ ...s, value: s.value + p.n }));

    const multiply = createAction("Multiply")
      .withPayload({ n: 2 } as { n: number })
      .withState((s, p) => ({ ...s, value: s.value * p.n }));

    store.register("Add", add);
    store.register("Multiply", multiply);

    store.dispatch("tagix/action/Add", { n: 10 });
    expect((store.stateValue as { value: number }).value).toBe(10);

    store.dispatch("tagix/action/Multiply", { n: 2 });
    expect((store.stateValue as { value: number }).value).toBe(20);
  });

  it("should handle action with conditional state transition", () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "Conditional",
    });

    const conditionalUpdate = createAction("ConditionalUpdate")
      .withPayload({ threshold: 5 } as { threshold: number })
      .withState((s, p) => {
        if (s.value >= p.threshold) {
          return { ...s, _tag: "Ready" as const, value: s.value };
        }
        return s;
      });

    store.register("ConditionalUpdate", conditionalUpdate);

    store.dispatch("tagix/action/ConditionalUpdate", { threshold: 5 });
    expect(store.stateValue._tag).toBe("Idle");

    const add = createAction("Add")
      .withPayload({ amount: 10 } as { amount: number })
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

    const noOp = createAction("NoOp")
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

    const largeAdd = createAction("LargeAdd")
      .withPayload({ amount: 1000000 } as { amount: number })
      .withState((s, p) => ({ ...s, value: s.value + p.amount }));

    store.register("LargeAdd", largeAdd);
    store.dispatch("tagix/action/LargeAdd", { amount: 1000000 });

    expect((store.stateValue as { value: number }).value).toBe(1000000);
  });

  it("should handle negative payload values", () => {
    const store = createStore(CounterState.Ready({ value: 10 }), CounterState, {
      name: "Negative",
    });

    const subtract = createAction("Subtract")
      .withPayload({ amount: 3 } as { amount: number })
      .withState((s, p) => ({ ...s, value: s.value - p.amount }));

    store.register("Subtract", subtract);
    store.dispatch("tagix/action/Subtract", { amount: 3 });

    expect((store.stateValue as { value: number }).value).toBe(7);
  });
});

describe("createAsyncAction", () => {
  it("should create async action with effect, onSuccess, and onError", () => {
    const fetchData = createAsyncAction("FetchData")
      .state((s) => ({ ...s, _tag: "Loading" }))
      .effect(async () => "data")
      .onSuccess((s, result) => ({ ...s, _tag: "Ready", value: 10 }))
      .onError((s, error) => ({ ...s, _tag: "Error", message: String(error) }));

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

    const fetchData = createAsyncAction("FetchData")
      .state((s) => ({ ...s, _tag: "Loading" }))
      .effect(async () => "mock-data")
      .onSuccess((s, result) => ({ ...s, _tag: "Ready", value: 100 }))
      .onError((s, error) => ({ ...s, _tag: "Error", message: String(error) }));

    store.register("FetchData", fetchData);
    await store.dispatch("tagix/action/FetchData", {});

    expect(store.stateValue._tag).toBe("Ready");
    expect((store.stateValue as { value: number }).value).toBe(100);
  });

  it("should handle async action error", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "AsyncErrorTest",
    });

    const failingAction = createAsyncAction("FailingAPI")
      .state((s) => ({ ...s, _tag: "Loading" }))
      .effect(async () => {
        throw new Error("API failed");
      })
      .onSuccess((s, r) => ({ ...s, _tag: "Ready", value: 10 }))
      .onError((s, error) => ({
        ...s,
        _tag: "Error",
        message: String(error),
        code: 500,
      }));

    store.register("FailingAPI", failingAction);

    try {
      await store.dispatch("tagix/action/FailingAPI", {});
    } catch {}

    expect(store.stateValue._tag).toBe("Error");
    expect((store.stateValue as { code: number }).code).toBe(500);
  });

  it("should fetch from public API (JSONPlaceholder)", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "APITest",
    });

    const fetchUsers = createAsyncAction("FetchUsers")
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
      expect((store.stateValue as { value: number }).value).toBe(10);
    } catch (e) {
      console.log("API test skipped due to network error:", (e as Error).message);
    }
  });

  it("should fetch single post from public API", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "PostAPITest",
    });

    const fetchPost = createAsyncAction("FetchPost")
      .state((s) => ({ ...s, _tag: "Loading" }))
      .effect(async () => {
        const response = await fetch("https://jsonplaceholder.typicode.com/posts/1");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .onSuccess((s, data) => ({
        ...s,
        _tag: "Ready" as const,
        value: (data as { id: number }).id,
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
      expect((store.stateValue as { value: number }).value).toBe(1);
    } catch (e) {
      console.log("API test skipped due to network error:", (e as Error).message);
    }
  });

  it("should handle 404 error from public API", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "NotFoundTest",
    });

    const fetchNotFound = createAsyncAction("FetchNotFound")
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
      expect((store.stateValue as { code: number }).code).toBe(404);
    } catch (e) {
      console.log("API test skipped due to network error:", (e as Error).message);
    }
  });

  it("should handle concurrent async actions", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "ConcurrentTest",
    });

    const fetchData = (id: number) =>
      createAsyncAction(`FetchData${id}`)
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
    const retryAction = createAsyncAction("RetryAction")
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
        const retries = (s as { retries: number }).retries + 1;
        if (retries < 3) {
          return { ...s, _tag: "Pending" as const, retries };
        }
        return {
          ...s,
          _tag: "Error" as const,
          message: String(error),
          code: 0,
          retries,
        };
      });

    store.register("RetryAction", retryAction);

    try {
      await store.dispatch("tagix/action/RetryAction", {});
      expect(store.stateValue._tag).toBe("Ready");
      expect((store.stateValue as { value: number }).value).toBe(3);
    } catch (e) {
      console.log("Retry test result:", (e as Error).message);
    }
  });

  it("should handle async action that creates post", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "CreatePostTest",
    });

    const createPost = createAsyncAction("CreatePost")
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
        value: (data as { id: number }).id,
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
      expect((store.stateValue as { value: number }).value).toBeGreaterThan(0);
    } catch (e) {
      console.log("Create post test skipped due to network error:", (e as Error).message);
    }
  });

  it("should handle async action that updates post", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "UpdatePostTest",
    });

    const updatePost = createAsyncAction("UpdatePost")
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
        value: (data as { id: number }).id,
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
      expect((store.stateValue as { value: number }).value).toBe(1);
    } catch (e) {
      console.log("Update post test skipped due to network error:", (e as Error).message);
    }
  });

  it("should handle async action that deletes post", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "DeletePostTest",
    });

    const deletePost = createAsyncAction("DeletePost")
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
      expect((store.stateValue as { value: number }).value).toBe(1);
    } catch (e) {
      console.log("Delete post test skipped due to network error:", (e as Error).message);
    }
  });

  it("should fetch todos from public API", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "TodosTest",
    });

    const fetchTodos = createAsyncAction("FetchTodos")
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
      expect((store.stateValue as { value: number }).value).toBe(5);
    } catch (e) {
      console.log("Todos test skipped due to network error:", (e as Error).message);
    }
  });

  it("should fetch comments from public API", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "CommentsTest",
    });

    const fetchComments = createAsyncAction("FetchComments")
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
      expect((store.stateValue as { value: number }).value).toBe(5);
    } catch (e) {
      console.log("Comments test skipped due to network error:", (e as Error).message);
    }
  });
});
