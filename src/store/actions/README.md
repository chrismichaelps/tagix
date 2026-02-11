---
category: State Management
---

<p align="center">
<img src="../../../public/tagix-logo.svg" alt="Tagix Logo" height="128" />
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

## State Freshness

`onSuccess` and `onError` receive the current (fresh) state, not the pending state. This means concurrent updates made during async execution are preserved:

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

## Dispatch Patterns

Actions can be dispatched using multiple patterns:

### String-Based (Traditional)

```ts
store.dispatch("tagix/action/Increment", { amount: 5 });
```

### Action Creator (Recommended)

Create reusable action creators for type-safe dispatch:

```ts
const increment = createAction("Increment")
  .withPayload({ amount: 1 })
  .withState((s, p) => ({ ...s, value: s.value + p.amount }));

// Curried action creator
const incrementBy = (payload: { amount: number }) => increment;

// Type-safe dispatch
store.dispatch(incrementBy, { amount: 5 });
```

### Async Action Dispatch

```ts
const fetchData = createAsyncAction("FetchData")
  .state((s) => ({ ...s, _tag: "Loading" }))
  .effect(async () => {
    const response = await fetch("/api/data");
    return response.json();
  })
  .onSuccess((s, data) => ({ ...s, _tag: "Success", data }))
  .onError((s, error) => ({ ...s, _tag: "Error", message: error.message }));

const fetchById = (payload: { id: number }) => fetchData;

// Async dispatch
await store.dispatch(fetchById, { id: 123 });
```

## createActionGroup

Create namespaced action groups to organize related actions and avoid naming collisions.

### Usage

```ts
import { createActionGroup, createStore, taggedEnum } from "tagix";

const UserState = taggedEnum({
  LoggedOut: {},
  LoggedIn: { name: "", email: "" },
});

const login = createAction("Login")
  .withPayload({ username: "" })
  .withState((_, payload) => UserState.LoggedIn({ name: payload.username, email: "" }));

const logout = createAction("Logout").withState(() => UserState.LoggedOut({}));

const updateProfile = createAction("UpdateProfile")
  .withPayload({ name: "", email: "" })
  .withState((state, payload) => {
    if (state._tag === "LoggedIn") {
      return UserState.LoggedIn({ ...state, ...payload });
    }
    return state;
  });

// Create a namespace group
const UserActions = createActionGroup("User", { login, logout, updateProfile });
// UserActions.login.type === "tagix/action/User/Login"
// UserActions.logout.type === "tagix/action/User/Logout"
// UserActions.updateProfile.type === "tagix/action/User/UpdateProfile"

const store = createStore(UserState.LoggedOut({}), UserState);
store.registerGroup(UserActions);
```

### Dispatch Patterns

Dispatch using the action group reference:

```ts
store.dispatch(UserActions.login, { username: "alice" });
store.dispatch(UserActions.logout);
store.dispatch(UserActions.updateProfile, { email: "alice@example.com" });
```

Or by string with namespace prefix:

```ts
store.dispatch("User/Login", { username: "alice" });
store.dispatch("User/Logout", {});
store.dispatch("User/UpdateProfile", { email: "alice@example.com" });
```

### Nested Namespaces

Create deeply nested namespaces:

```ts
const CartActions = createActionGroup("Shop/Cart", {
  addItem,
  removeItem,
  checkout,
});
// CartActions.addItem.type === "tagix/action/Shop/Cart/AddItem"
```

### Async Actions in Groups

Async actions work seamlessly with groups:

```ts
const fetchUser = createAsyncAction("FetchUser")
  .state((s) => s)
  .effect(async () => {
    const response = await fetch("/api/user");
    return response.json();
  })
  .onSuccess((_, user) => UserState.LoggedIn({ name: user.name, email: user.email }))
  .onError(() => UserState.LoggedOut({}));

const UserActions = createActionGroup("User", { login, fetchUser });

store.dispatch(UserActions.fetchUser, {});
await store.dispatch(UserActions.fetchUser, {});
```

### Multiple Groups Per Store

Register multiple groups on a single store:

```ts
const UserActions = createActionGroup("User", { login, logout });
const CartActions = createActionGroup("Cart", { addItem, removeItem, clearCart });

store.registerGroup(UserActions);
store.registerGroup(CartActions);
```

### Cross-Store Groups

Register the same group on different stores with different state types:

```ts
const SharedActions = createActionGroup("Shared", { login, logout });

userStore.registerGroup(SharedActions);
cartStore.registerGroup(SharedActions);

userStore.dispatch("Shared/Login", { username: "user" });
cartStore.dispatch("Shared/Login", { userId: 123 });
```

### Benefits

- **Collision Prevention**: Namespaces prevent naming conflicts between features
- **Organization**: Group related actions under a shared prefix
- **Type Safety**: Full TypeScript inference preserved
- **Flexibility**: Works with sync and async actions
- **Compatibility**: Can dispatch by string or action reference

## Related

- [createAction](./index.ts) - Synchronous actions
- [createActionGroup](./group.ts) - Action grouping with namespaces
- [createStore](../core/factory.ts) - Store creation
- [matchState](../match/index.ts) - Pattern matching on state
