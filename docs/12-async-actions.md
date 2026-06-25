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
const fetchUsers = createAsyncAction("FetchUsers")
  .state((s) => ({
    ...s,
    _tag: "Loading",
  }))
  .effect(async () => fetch("/api/users").then((r) => r.json()))
  .onSuccess((state, data) => ({ ...state, _tag: "Success", data }))
  .onError((state, error) => ({ ...state, _tag: "Error", message: String(error) }));
```

### effect(fn)

Define the asynchronous operation. Return a promise that resolves with the result.

```ts
const fetchUsers = createAsyncAction("FetchUsers")
  .state((s) => ({ ...s, _tag: "Loading" }))
  .effect(async () => {
    const response = await fetch("/api/users");
    return response.json();
  })
  .onSuccess((state, data) => ({ ...state, _tag: "Success", data }))
  .onError((state, error) => ({ ...state, _tag: "Error", message: String(error) }));
```

**The effect's return type is inferred and flows into `onSuccess`** — `data` is the concrete result type, never `unknown`. You don't need the third type argument on `createAsyncAction`; annotate the effect's return (or let it infer) to type the result precisely:

```ts
interface User {
  id: number;
  name: string;
}

createAsyncAction<{ id: number }, AppState>("FetchUser")
  .state(() => AppState.Loading({}))
  .effect(async (payload): Promise<User> => {
    const res = await fetch(`/api/users/${payload.id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as User;
  })
  .onSuccess((s, user) => AppState.Ready({ user })) // `user` is typed as User
  .onError((s, error) => AppState.Failed({ message: String(error) }));
```

### onSuccess(fn)

Define the state transition when the effect completes successfully.

```ts
const fetchUsers = createAsyncAction("FetchUsers")
  .state((s) => ({ ...s, _tag: "Loading" }))
  .effect(async () => fetch("/api/users").then((r) => r.json()))
  .onSuccess((state, data) => ({
    ...state,
    _tag: "Success",
    data,
  }))
  .onError((state, error) => ({ ...state, _tag: "Error", message: String(error) }));
```

### onError(fn)

Define the state transition when the effect fails.

```ts
const fetchUsers = createAsyncAction("FetchUsers")
  .state((s) => ({ ...s, _tag: "Loading" }))
  .effect(async () => fetch("/api/users").then((r) => r.json()))
  .onSuccess((state, data) => ({ ...state, _tag: "Success", data }))
  .onError((state, error) => ({
    ...state,
    _tag: "Error",
    message: error instanceof Error ? error.message : String(error),
  }));
```

### Accessing services in onSuccess / onError

Like `effect`, the `onSuccess` and `onError` handlers receive the dispatch **context** as a third argument, so they can use services (logging, error reporting, analytics) when dispatched via a context. The argument is optional — handlers that ignore it are unchanged.

```ts
const fetchUser = createAsyncAction<{ id: string }, UserState, User>("FetchUser")
  .state((s) => ({ ...s, _tag: "Loading" }))
  .effect((payload, context) => context.getService(Api).getUser(payload.id))
  .onSuccess((state, user, context) => {
    context.getService(Logger).info(`loaded ${user.id}`);
    return { ...state, _tag: "Success", user };
  })
  .onError((state, error, context) => {
    context.getService(Reporter).report(error);
    return { ...state, _tag: "Error", message: String(error) };
  });

// Dispatch through a context so services are available:
context.dispatch(fetchUser, { id: "42" });
```

> The context is only populated when dispatching through a `TagixContext`. With a bare `store.dispatch`, the third argument is `null`.

## Complete Example

```ts
import { createStore, createAsyncAction, taggedEnum } from "tagix";

const UserState = taggedEnum({
  Idle: {},
  Loading: {},
  Success: { users: [], total: 0 },
  Error: { message: "", status: 0 },
});

const store = createStore(UserState.Idle({}), UserState);

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
    message: error instanceof Error ? error.message : String(error),
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
  })
  .onError((s, error) => ({ ...s, _tag: "Error", message: String(error) }));
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
  })
  .onError((s, error) => ({ ...s, _tag: "Error", message: String(error) }));

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
    message: error instanceof Error ? error.message : String(error),
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
  .onError((s, error) => ({ ...s, _tag: "Error", message: String(error) }));
```

## Concurrent Actions

Multiple async actions can run at the same time.

```ts
const fetchUser = createAsyncAction("FetchUser")
  .state((s) => s)
  .effect(async (payload: { id: number }) => {
    const response = await fetch(`/api/users/${payload.id}`);
    return response.json();
  })
  .onSuccess((s, user) => ({ ...s, currentUser: user }))
  .onError((s, error) => ({ ...s, userError: String(error) }));

const fetchPosts = createAsyncAction("FetchPosts")
  .state((s) => s)
  .effect(async () => {
    const response = await fetch("/api/posts");
    return response.json();
  })
  .onSuccess((s, posts) => ({ ...s, posts }))
  .onError((s, error) => ({ ...s, postsError: String(error) }));

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
