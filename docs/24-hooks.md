---
category: Features
alias: hooks
title: Hook Utilities
description: Type-safe utilities for accessing state and dispatching actions through TagixContext
---

# Hook Utilities

Hook utilities provide convenient functions for accessing state and dispatching actions through a `TagixContext`. These work with any framework that supports hooks patterns.

## useMatch

Exhaustive pattern matching on the current state. Every variant tag must be handled — the compiler enforces exhaustiveness. Returns the union of all handler return types.

```ts
const name = useMatch(context, {
  LoggedIn: (s) => s.name,
  LoggedOut: () => "Guest",
});
// name is inferred as string
```

## useWhen

Narrow the current state to a single variant by tag. Returns the variant's properties (without `_tag`) if matched, `undefined` otherwise.

```ts
const user = useWhen(context, "LoggedIn");
if (user) {
  console.log(user.name); // fully typed
}
```

## useDispatch

Returns a typed dispatch function. Supports **action-object dispatch** (recommended) for full type safety, and legacy string-based dispatch.

```ts
const dispatch = useDispatch(context);

// Recommended: Typed dispatch with action reference
dispatch(loginAction, { username: "chris" });

// Legacy: String-based dispatch (deprecated)
dispatch("Login", { username: "chris" });
```

## useActionGroup

Create typed dispatchers from an action group. Each key in the group becomes a typed method.

```ts
const UserActions = createActionGroup("Auth", { login, logout });
const dispatch = useActionGroup(context, UserActions);

dispatch.login({ username: "chris" }); // fully typed
```

## useMatchPartial

Non-exhaustive pattern matching. Only handles specify variants; others return `undefined`.

```ts
const greeting = useMatchPartial(context, {
  LoggedIn: (s) => `Welcome, ${s.name}`,
});
// greeting: string | undefined
```

## useStore

Returns the current state snapshot from a context.

```ts
const state = useStore(context);
```

## useSelector

Returns a derived value from state via a selector function.

```ts
const itemCount = useSelector(context, (s) => (s._tag === "Items" ? s.items.length : 0));
```

## useSubscribe

Listen for state changes with a callback. Returns an unsubscribe function.

```ts
const unsubscribe = useSubscribe(context, (state) => {
  console.log("New state:", state._tag);
});
```

## createSelector

Build a selector function that reads the latest state every time it's called.

```ts
const getName = createSelector(context, (s) => s.user?.name);
const name = getName();
```

---

## Legacy / Deprecated Hooks

These hooks are preserved for backward compatibility but will be removed in the next major version.

### useGetState

**Deprecated**: Use `useMatch` or `useWhen` instead. Requires manual generics and double-currying.

### useKey

**Deprecated**: Use `useWhen` or `useMatch` instead to ensure variant-aware access.

### getStateProp

**Deprecated**: Use `$match` on the tagged enum constructor directly.

---

## Complete Example

```ts
import { createContext, createStore, createAction, taggedEnum, createActionGroup } from "tagix";
import { useMatch, useWhen, useDispatch, useActionGroup } from "tagix/hooks";

const UserState = taggedEnum({
  LoggedOut: {},
  LoggedIn: { name: "", email: "" },
});

const login = createAction("Login")
  .withPayload({ username: "" })
  .withState((_, p) => UserState.LoggedIn({ name: p.username, email: "" }));

const UserActions = createActionGroup("Auth", { login });

const store = createStore(UserState.LoggedOut({}), UserState);
store.registerGroup(UserActions);
const context = createContext(store);

// 1. Exhaustive matching
const name = useMatch(context, {
  LoggedIn: (s) => s.name,
  LoggedOut: () => "Visitor",
});

// 2. Structural narrowing
const user = useWhen(context, "LoggedIn");
if (user) {
  console.log(user.email);
}

// 3. Typed dispatch (Action Group)
const dispatch = useActionGroup(context, UserActions);
dispatch.login({ username: "chris" });

// 4. Typed dispatch (Individual Action)
const directDispatch = useDispatch(context);
directDispatch(login, { username: "michael" });
```
