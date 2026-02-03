---
category: Getting Started
alias: core-concepts
title: Core Concepts
description: Understand the foundational concepts that power Tagix
---

# Core Concepts

Understand the foundational concepts that power Tagix.

## Tagged Unions

Tagix uses tagged unions (discriminated unions) for state representation. Each state variant carries a unique `_tag` property that enables exhaustive type checking:

```ts
const UserState = taggedEnum({
  Unauthenticated: {},
  Authenticating: { loading: true },
  Authenticated: { user: { id: number; name: string } },
  AuthError: { message: string },
});
```

The compiler ensures all variants are handled:

```ts
function processUserState(state: UserStateType) {
  switch (state._tag) {
    case "Unauthenticated":
      return "Please log in";
    case "Authenticating":
      return "Logging in...";
    case "Authenticated":
      return `Welcome, ${state.user.name}`;
    case "AuthError":
      return state.message;
    default:
      // TypeScript ensures no other variants exist
      return assertNever(state);
  }
}
```

## Actions

Actions are the mechanism for state transitions. An action consists of:

1. **Type identifier** - A unique string identifying the action
2. **Payload type** - Optional data passed with the action
3. **State handler** - Function that computes the next state

```ts
const increment = createAction<{ amount: number }, State>("Increment")
  .withPayload({ amount: 1 })
  .withState((state, payload) => ({
    ...state,
    value: state.value + payload.amount,
  }));
```

## Stores

A store is the central state container that:

- Holds the current state value
- Manages action registration
- Handles dispatch logic
- Notifies subscribers of changes

```ts
const store = createStore(initialState, stateDefinition, {
  name: "MyStore",
  middleware: [logger],
});
```

## Subscribers

Components can subscribe to state changes:

```ts
const unsubscribe = store.subscribe((state) => {
  // Called on every state change
});

unsubscribe(); // Cleanup
```

## Middleware

Middleware extends dispatch behavior by intercepting actions:

```ts
const loggerMiddleware = () => (next) => (action) => {
  console.log("Action:", action.type);
  return next(action);
};
```

## Type Inference

Tagix provides complete type inference through the state definition:

```ts
const CounterState = taggedEnum({
  Idle: { value: 0 },
  Ready: { value: 0 },
});

// Type is automatically inferred as:
// { readonly _tag: "Idle"; readonly value: 0 } | { readonly _tag: "Ready"; readonly value: 0 }
const state = CounterState.Idle({ value: 0 });
```

## Key Principles

1. **State First** - Define state before actions
2. **Explicit Transitions** - Every state change goes through actions
3. **Type Safety** - Let TypeScript enforce correctness
4. **Framework Agnostic** - Works with any UI library
5. **Functional** - Immutable updates, pure functions
