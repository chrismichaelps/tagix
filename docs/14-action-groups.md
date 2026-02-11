---
category: State Management
alias: action-groups
title: Action Groups
description: Group related actions under a common namespace to avoid naming collisions
---

# Action Groups

Action groups namespace related actions together to prevent naming conflicts in larger applications. Groups make it easier to organize actions by feature or domain.

## Why Use Action Groups

In large applications, you might have multiple features that each define their own actions. Without namespacing, you could accidentally create two actions with the:

same type```ts
// Feature 1
const login = createAction("Login").withState(...);

// Feature 2
const login = createAction("Login").withState(...);
// Error: Duplicate action type "tagix/action/Login"

````

Action groups solve this by adding a prefix to each action type.

## Creating Action Groups

Use `createActionGroup` to namespace your actions.

```ts
import { createAction, createActionGroup, taggedEnum } from "tagix";

const UserState = taggedEnum({
  LoggedOut: {},
  LoggedIn: { name: "", email: "" },
});

const login = createAction("Login").withState((_, { username }) =>
  UserState.LoggedIn({ name: username, email: "" })
);

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

// Action types are now prefixed:
// UserActions.login.type === "tagix/action/User/Login"
// UserActions.logout.type === "tagix/action/User/Logout"
// UserActions.updateProfile.type === "tagix/action/User/UpdateProfile"
````

## Dispatching Group Actions

Dispatch actions using the group reference or by string.

```ts
const store = createStore(UserState.LoggedOut({}), UserState);
store.registerGroup(UserActions);

// Using the group reference
store.dispatch(UserActions.login, { username: "chris" });
store.dispatch(UserActions.logout);
store.dispatch(UserActions.updateProfile, { email: "chris@example.com" });

// Or by string with namespace prefix
store.dispatch("User/Login", { username: "chris" });
store.dispatch("User/Logout", {});
store.dispatch("User/UpdateProfile", { email: "chris@example.com" });
```

## Nested Namespaces

Create deeper namespaces by including slashes in the namespace string.

```ts
const CartActions = createActionGroup("Cart", {
  addItem,
  removeItem,
  checkout,
});

// Action types include nested prefix:
// CartActions.addItem.type === "tagix/action/Cart/AddItem"
// CartActions.removeItem.type === "tagix/action/Cart/RemoveItem"
// CartActions.checkout.type === "tagix/action/Cart/Checkout"
```

## Async Actions in Groups

Async actions work seamlessly with groups.

```ts
const UserState = taggedEnum({
  LoggedOut: {},
  LoggedIn: { name: "", email: "" },
});

const fetchUser = createAsyncAction("FetchUser")
  .state((s) => s)
  .effect(async () => {
    return { name: "Test User", email: "test@example.com" };
  })
  .onSuccess((_, user) => UserState.LoggedIn({ name: user.name, email: user.email }))
  .onError(() => UserState.LoggedOut({}));

const login = createAction("Login")
  .withPayload({ username: "" })
  .withState((_, payload) => UserState.LoggedIn({ name: payload.username, email: "" }));

const UserActions = createActionGroup("User", { login, fetchUser });

// Both sync and async actions are prefixed
store.dispatch(UserActions.fetchUser, {});
await store.dispatch(UserActions.fetchUser, {});
```

## Multiple Groups Per Store

Register multiple groups on a single store.

```ts
const UserActions = createActionGroup("User", { login, logout });
const CartActions = createActionGroup("Cart", { addItem, removeItem, clearCart });

store.registerGroup(UserActions);
store.registerGroup(CartActions);
```

## Cross-Store Groups

Use the same group on different stores with different state types.

```ts
const UserState = taggedEnum({
  LoggedOut: {},
  LoggedIn: { name: "", email: "" },
});

const CartState = taggedEnum({
  Empty: {},
  HasItems: { items: [] as { name: string; price: number }[] },
});

const login = createAction("Login")
  .withPayload({ username: "" })
  .withState((_, payload) => UserState.LoggedIn({ name: payload.username, email: "" }));

const addItem = createAction("AddItem")
  .withPayload({ name: "", price: 0 })
  .withState((state, payload) =>
    state._tag === "HasItems"
      ? CartState.HasItems({
          items: [...state.items, { name: payload.name, price: payload.price }],
        })
      : CartState.HasItems({ items: [{ name: payload.name, price: payload.price }] })
  );

const SharedActions = createActionGroup("Shared", { login, addItem });

userStore.registerGroup(SharedActions);
cartStore.registerGroup(SharedActions);

userStore.dispatch("Shared/Login", { username: "user" });
cartStore.dispatch("Shared/AddItem", { name: "Widget", price: 29.99 });
```

## Complete Example

```ts
import { createStore, createAction, createActionGroup, taggedEnum } from "tagix";

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

// Create namespaced action group
const UserActions = createActionGroup("User", { login, logout, updateProfile });

const store = createStore(UserState.LoggedOut({}), UserState);
store.registerGroup(UserActions);

// Dispatch using group
store.dispatch(UserActions.login, { username: "chris" });
store.dispatch(UserActions.updateProfile, { email: "chris@example.com" });
store.dispatch(UserActions.logout);
```

## Benefits

- **Collision Prevention**: Namespaces prevent naming conflicts between features
- **Organization**: Group related actions under a shared prefix
- **Type Safety**: Full TypeScript inference preserved
- **Flexibility**: Works with sync and async actions
- **Compatibility**: Can dispatch by string or action reference

## See Also

- [Actions](11-actions.md) - Synchronous actions
- [Async Actions](12-async-actions.md) - Asynchronous operations
- [createAction](../actions/index.md) - Action creator API
