---
category: State Management
---

<p align="center">
<img src="../../../public/tagix-logo.svg" alt="Tagix Logo" height="128" />
</p>

# Hook Utilities

Simple utilities for accessing state and dispatching actions through a TagixContext.

## useStore

Returns the current state from a context.

```ts
const state = useStore(context);
```

## useSelector

Returns a derived value from state. The selector runs once to get the current value.

```ts
const userName = useSelector(context, (state) =>
  state._tag === "Authenticated" ? state.user?.name : null
);
```

## useSubscribe

Calls a callback whenever state changes. Returns an unsubscribe function.

```ts
const unsubscribe = useSubscribe(context, (state) => {
  console.log("State changed:", state);
});
```

## useKey

Returns a specific property from state.

```ts
const count = useKey(context, "count");
```

## useDispatch

Returns a dispatch function for sending actions.

```ts
const dispatch = useDispatch(context);
dispatch("Increment", { amount: 1 });
```

## createSelector

Creates a selector function that you can call multiple times. Each call returns the current value from state.

```ts
const getUserName = createSelector(context, (state) => state.user?.name);
const name = getUserName();
```

## useGetState

Get a type-safe way to read state properties by variant tag. IDE will autocomplete the tag names and their properties.

```ts
const getUserState = useGetState<UserStateType>();
const context = createContext(store);

// Get a single property
const name = getUserState(context)("LoggedIn", "name");

// Or get the whole props object for a tag
const userProps = getUserState(context)("LoggedIn");
if (userProps) {
  console.log(userProps.name);
  console.log(userProps.email);
}
```

## getStateProp

Read a specific property from a state object using its variant tag. Works with any state object, not just contexts.

```ts
const state = store.getCurrent();

// Get a single property
const name = getStateProp(state)("LoggedIn", "name");

// Or get the whole props object for a tag
const userProps = getStateProp(state)("LoggedIn");
if (userProps) {
  console.log(userProps.name);
  console.log(userProps.email);
}
```

## Complete Example

```ts
import { createContext, createStore, createAction, taggedEnum } from "tagix";
import { useStore, useSelector, useDispatch, useGetState } from "tagix/hooks";

const UserState = taggedEnum({
  LoggedOut: {},
  LoggedIn: { name: "", email: "" },
});

const login = createAction("Login")
  .withPayload({ username: "" })
  .withState((_, payload) => UserState.LoggedIn({ name: payload.username, email: "" }));

const store = createStore(UserState.LoggedOut({}), UserState);
const context = createContext(store);

store.register("Login", login);

// Using hooks
const state = useStore(context);
const userName = useSelector(context, (s) => (s._tag === "LoggedIn" ? s.name : null));
const dispatch = useDispatch(context);
const getUserState = useGetState<UserStateType>()(context);

dispatch("Login", { username: "chris" });

// Read state properties with autocomplete
const name = getUserState("LoggedIn", "name");
const userProps = getUserState("LoggedIn");

if (userProps) {
  console.log(name); // "chris"
  console.log(userProps.name); // "chris"
  console.log(userProps.email); // ""
}
```

## Related

- [createContext](../context/index.ts) - Create a context from a store
- [createStore](../core/factory.ts) - Create a store instance
- [selectors](../selectors/index.ts) - Additional selector utilities
