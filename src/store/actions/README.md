---
category: State Management
---

<p align="center">
  <img src="../../../public/tagix-logo.png" alt="Tagix Logo" width="50%" />
</p>

# createAsyncAction

Create type-safe asynchronous actions for Tagix stores. Handles API calls, side effects, and complex async workflows.

## Usage

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

## API

### state(fn)

Define the state transition before the async effect executes (e.g., set loading state).

```ts
const fetchUsers = createAsyncAction("FetchUsers").state((s) => ({
  ...s,
  _tag: "Loading",
}));
```

### effect(fn)

Define the async operation (API call, file read, etc.).

```ts
const fetchUsers = createAsyncAction("FetchUsers").effect(async () => {
  const response = await fetch("/api/users");
  return response.json();
});
```

### onSuccess(fn)

Define state transition on successful async completion.

```ts
const fetchUsers = createAsyncAction("FetchUsers").onSuccess((state, data) => ({
  ...state,
  _tag: "Success",
  data,
}));
```

### onError(fn)

Define state transition on async failure.

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

## Type Inference

All types are automatically inferred from your state definition and callbacks:

```ts
const fetchData = createAsyncAction("FetchData")
  .state((s) => {
    /* s inferred as UserState */
  })
  .effect(async () => {
    /* returns User[] */
  })
  .onSuccess((s, users) => {
    // s: UserState
    // users: User[]
    return { ...s, _tag: "Success", users };
  });
```

## Dispatch Return Value

Async action dispatch returns a Promise:

```ts
const result = await store.dispatch("tagix/action/FetchUsers", {});
// result resolves when async completes
// rejects if effect throws
```

## Error Handling

Errors in the effect are caught and passed to `onError`:

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
  // This won't run - errors are caught by onError
}
```

## Retry Logic

Implement retry patterns:

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

Multiple async actions can run concurrently:

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

## Related

- [createAction](./index.ts) - Synchronous actions
- [createStore](../core/factory.ts) - Store creation
- [matchState](../match/index.ts) - Pattern matching on state
