---
category: State Management
---

<p align="center">
<img src="../../../public/tagix-logo.svg" alt="Tagix Logo" height="128" />
</p>

# Hook Utilities

Type-safe utilities for accessing state and dispatching actions through a `TagixContext`.

## useMatch

Exhaustive pattern matching on the current state. Every variant tag must be handled — the compiler enforces exhaustiveness. Returns the union of all handler return types.

```ts
const name = useMatch(context, {
  LoggedIn: (s) => s.name,
  LoggedOut: () => "Guest",
});
// name: string
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
```

## useActionGroup

Create typed dispatchers from an action group. Each key in the group becomes a typed method.

```ts
const UserActions = createActionGroup("Auth", { login, logout });
const dispatch = useActionGroup(context, UserActions);

dispatch.login({ username: "chris" }); // fully typed
```

## useMatchPartial

Non-exhaustive pattern matching. Only handles specified variants; others return `undefined`.

```ts
const greeting = useMatchPartial(context, {
  LoggedIn: (s) => `Welcome, ${s.name}`,
});
```

## useStore

Returns the current state snapshot from a context.

```ts
const state = useStore(context);
```

## useSelector

Returns a derived value from state via a selector function.

```ts
const userName = useSelector(context, (s) => (s._tag === "LoggedIn" ? s.name : null));
```

---

## Legacy / Deprecated Hooks

- **useGetState**: Deprecated. Use `useMatch` or `useWhen` instead.
- **useKey**: Deprecated. Use `useWhen` or `useMatch` instead.
- **getStateProp**: Deprecated. Use `$match` on the tagged enum constructor directly.

---

## Complete Example

```ts
import { createContext, createStore, createAction, taggedEnum, createActionGroup } from "tagix";
import { useMatch, useWhen, useDispatch, useActionGroup } from "tagix";

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
  console.log(user.name);
}

// 3. Typed dispatch (Action Group)
const dispatch = useActionGroup(context, UserActions);
dispatch.login({ username: "chris" });
```

## Related

- [createContext](../context/index.ts) - Create a context from a store
- [createStore](../core/factory.ts) - Create a store instance
- [selectors](../selectors/index.ts) - Additional selector utilities
