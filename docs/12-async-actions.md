---
category: State Management
alias: async-actions
title: Async Actions
description: Handle asynchronous operations with effects, success, and error handlers
---

# Async Actions

Async actions handle operations that involve promises, API calls, or other side effects. They separate the async work from state updates, making your code easier to test and reason about.

## Creating Async Actions

Use `createAsyncAction` to define async operations with explicit state transitions.

```ts
import { createAsyncAction, taggedEnum } from "tagix";

const ApiState = taggedEnum({
  Idle: {},
  Loading: {},
  Success: { data: null },
  Error: { message: "" },
});

const fetchUsers = createAsyncAction("FetchUsers")
  .state((s) => ({ ...s, _tag: "Loading" }))
  .effect(async () => {
    const response = await fetch("/api/users");
    return response.json();
  })
  .onSuccess((state, data) => ({
    ...state,
    _tag: "Success",
    data,
  }))
  .onError((state, error) => ({
    ...state,
    _tag: "Error",
    message: error.message,
  }));
```

## Action Components

### state(fn)

Define the state transition when the async action starts. This runs immediately when you dispatch the action.

```ts
const fetchUsers = createAsyncAction("FetchUsers").state((s) => ({
  ...s,
  _tag: "Loading",
}));
```

### effect(fn)

Define the asynchronous operation. Return a promise that resolves with the result.

```ts
const fetchUsers = createAsyncAction("FetchUsers").effect(async () => {
  const response = await fetch("/api/users");
  return response.json();
});
```

### onSuccess(fn)

Define the state transition when the effect completes successfully.

```ts
const fetchUsers = createAsyncAction("FetchUsers").onSuccess((state, data) => ({
  ...state,
  _tag: "Success",
  data,
}));
```

### onError(fn)

Define the state transition when the effect fails.

```ts
const fetchUsers = createAsyncAction("FetchUsers").onError((state, error) => ({
  ...state,
  _tag: "Error",
  message: error.message,
}));
```

## Complete Example

```ts
import { createStore, createAsyncAction, taggedEnum } from "tagix";

const UserState = taggedEnum({
  Idle: {},
  Loading: {},
  Success: { users: [], total: 0 },
  Error: { message: "", status: 0 },
});

const store = createStore(UserState.Idle());

const fetchUsers = createAsyncAction("FetchUsers")
  .state((s) => ({ ...s, _tag: "Loading" }))
  .effect(async () => {
    const response = await fetch("https://api.example.com/users");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return data;
  })
  .onSuccess((state, users) => ({
    ...state,
    _tag: "Success",
    users,
    total: users.length,
  }))
  .onError((state, error) => ({
    ...state,
    _tag: "Error",
    message: error.message,
    status: 500,
  }));

store.register("FetchUsers", fetchUsers);

await store.dispatch("tagix/action/FetchUsers", {});
```

## Dispatching Async Actions

Async action dispatch returns a Promise.

```ts
// Await the result
await store.dispatch("tagix/action/FetchUsers", {});

// Handle errors
try {
  await store.dispatch("tagix/action/FetchUsers", {});
} catch (error) {
  console.error("Action failed:", error);
}
```

## Type Inference

All types are automatically inferred from your state definition and callbacks.

```ts
const fetchData = createAsyncAction("FetchData")
  .state((s) => {
    // s inferred as UserState
  })
  .effect(async () => {
    // returns User[]
  })
  .onSuccess((s, users) => {
    // s: UserState
    // users: User[]
    return { ...s, _tag: "Success", users };
  });
```

## State Freshness

The `onSuccess` and `onError` handlers receive the current state, not the pending state. This means concurrent updates made during async execution are preserved.

```ts
const asyncAction = createAsyncAction("AsyncAction")
  .state((s) => ({ ...s, _tag: "Loading", value: s.value }))
  .effect(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return 10;
  })
  .onSuccess((s, result) => {
    // s is the current state after any concurrent updates
    return { ...s, _tag: "Ready", value: s.value + result };
  });

store.dispatch("tagix/action/AsyncAction", {});
store.dispatch("tagix/action/Increment", { amount: 5 });
// onSuccess receives state with value=5 (not 0), result=10
// Returns Ready { value: 15 }
```

## Error Handling

Errors in the effect are caught and passed to `onError`. The error does not reject the dispatch Promise.

```ts
const riskyFetch = createAsyncAction("RiskyFetch")
  .effect(async () => {
    const response = await fetch("/api/might-fail");
    if (!response.ok) {
      throw new Error("Request failed");
    }
    return response.json();
  })
  .onError((state, error) => ({
    ...state,
    _tag: "Error",
    message: error.message,
  }));

try {
  await store.dispatch("tagix/action/RiskyFetch", {});
} catch (error) {
  // This never runs - errors are caught by onError
}
```

## Retry Logic

Implement retry patterns inside the effect.

```ts
const fetchWithRetry = createAsyncAction("FetchWithRetry")
  .state((s) => s)
  .effect(async () => {
    let attempts = 0;
    while (attempts < 3) {
      try {
        const response = await fetch("/api/data");
        return await response.json();
      } catch {
        attempts++;
        if (attempts >= 3) throw new Error("Max retries exceeded");
      }
    }
  })
  .onSuccess((s, data) => ({ ...s, _tag: "Success", data }))
  .onError((s, error) => ({ ...s, _tag: "Error", message: error.message }));
```

## Concurrent Actions

Multiple async actions can run at the same time.

```ts
const fetchUser = createAsyncAction("FetchUser")
  .state((s) => s)
  .effect(async () => {
    const response = await fetch(`/api/users/${id}`);
    return response.json();
  })
  .onSuccess((s, user) => ({ ...s, currentUser: user }));

const fetchPosts = createAsyncAction("FetchPosts")
  .state((s) => s)
  .effect(async () => {
    const response = await fetch("/api/posts");
    return response.json();
  })
  .onSuccess((s, posts) => ({ ...s, posts }));

store.register("FetchUser", fetchUser);
store.register("FetchPosts", fetchPosts);

await Promise.all([
  store.dispatch("tagix/action/FetchUser", { id: 1 }),
  store.dispatch("tagix/action/FetchPosts", {}),
]);
```

## Dispatch Patterns

Actions can be dispatched using multiple patterns.

### String-Based Dispatch

```ts
store.dispatch("tagix/action/Increment", { amount: 5 });
```

### Action Creator

Create reusable action creators for type-safe dispatch.

```ts
const increment = createAction("Increment")
  .withPayload({ amount: 1 })
  .withState((s, p) => ({ ...s, value: s.value + p.amount }));

const incrementBy = (payload: { amount: number }) => increment;

store.dispatch(incrementBy, { amount: 5 });
```

## See Also

- [Actions](11-actions.md) - Synchronous actions
- [Error Handling](23-error-handling.md) - Error patterns
- [Middleware](21-middleware.md) - Request middleware
