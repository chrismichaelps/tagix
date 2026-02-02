---
category: State Management
alias: actions
title: Actions
description: Synchronous action creators for state updates
keywords:
  - actions
  - state updates
  - synchronous
sidebar:
  position: 2
  label: Actions
  icon: arrow-right-circle
tags:
  - actions
  - state
author: Tagix Team
last_updated: 2026-02-02
version: 1.0.0
draft: false
pagination_prev: 10-state-definitions
pagination_next: 12-async-actions
head:
  - tag: meta
    attrs:
      property: og:type
      content: article
  - tag: meta
    attrs:
      property: og:title
      content: Actions - Tagix
  - tag: meta
    attrs:
      property: og:description
      content: Create synchronous actions
  - tag: meta
    attrs:
      property: og:image
      content: @public/tagix-logo.png
code_annotations: true
line_numbers: true
hide_table_of_contents: false
toc_max_heading_level: 3
lang: en
dir: ltr
---

# Actions

Synchronous action creators for state updates.

## Creating Actions

Use `createAction` to define actions with type-safe payloads and state transitions:

```ts
import { createAction } from "tagix";

const increment = createAction<{ amount: number }, CounterState>("Increment")
  .withPayload({ amount: 1 })
  .withState((state, payload) => ({
    ...state,
    value: state.value + payload.amount,
  }));
```

## Action Components

### Type Identifier

The first parameter is a unique action type:

```ts
const action = createAction<Payload, State>("MyAction");
// Action type becomes: "tagix/action/MyAction"
```

### Payload Type

Define the shape of data passed with the action:

```ts
// No payload
const reset = createAction<void, State>("Reset")
  .withPayload(undefined)
  .withState(() => initialState);

// With payload
const setValue = createAction<{ value: number }, State>("SetValue")
  .withPayload({ value: 0 })
  .withState((state, payload) => ({ ...state, value: payload.value }));
```

### State Handler

The `withState` method defines how state transitions:

```ts
const increment = createAction<{ amount: number }, State>("Increment")
  .withPayload({ amount: 1 })
  .withState((currentState, payload) => {
    // Return new state
    return {
      ...currentState,
      value: currentState.value + payload.amount,
    };
  });
```

## Registering Actions

Actions must be registered with the store:

```ts
const store = createStore(initialState, state);

store.register("Increment", increment);
store.register("Decrement", decrement);
store.register("Reset", reset);
```

## Dispatching Actions

### String-Based Dispatch

```ts
store.dispatch("tagix/action/Increment", { amount: 5 });
```

### Action Creator Dispatch

Pass the action creator directly:

```ts
// Direct action
store.dispatch(increment, { amount: 5 });

// Curried action creator
const incrementBy = (amount: number) => increment;
store.dispatch(incrementBy, { amount: 10 });
```

### Action Creator Pattern

Define reusable action creators:

```ts
const createIncrement = (defaultAmount: number) =>
  createAction<{ amount: number }, State>("Increment")
    .withPayload({ amount: defaultAmount })
    .withState((state, payload) => ({
      ...state,
      value: state.value + payload.amount,
    }));

const incrementBy5 = createIncrement(5);
store.dispatch(incrementBy5);
```

## Conditional State Transitions

State handlers can conditionally return different states:

```ts
const updateUser = createAction<{ name: string }, UserState>("UpdateUser")
  .withPayload({ name: "" })
  .withState((state, payload) => {
    if (state._tag !== "Authenticated") {
      return state; // No change
    }
    return {
      ...state,
      user: { ...state.user, name: payload.name },
    };
  });
```

## Multiple Actions

Handle multiple sequential actions:

```ts
const add = createAction<{ n: number }, CounterState>("Add")
  .withPayload({ n: 10 })
  .withState((s, p) => ({ ...s, value: s.value + p.n }));

const multiply = createAction<{ n: number }, CounterState>("Multiply")
  .withPayload({ n: 2 })
  .withState((s, p) => ({ ...s, value: s.value * p.n }));

store.register("Add", add);
store.register("Multiply", multiply);

store.dispatch("tagix/action/Add", { n: 10 });
store.dispatch("tagix/action/Multiply", { n: 2 });
// Result: value = 20
```

## Error Handling

Actions throw errors for unregistered types:

```ts
try {
  store.dispatch("tagix/action/Unknown", {});
} catch (error) {
  if (error instanceof ActionNotFoundError) {
    console.log("Action not registered");
  }
}
```

## Best Practices

### One Action, One Responsibility

Each action should handle one logical update:

```ts
// Good - focused actions
const setUser = createAction<{ user: User }, State>("SetUser").withState((s, p) => ({
  ...s,
  user: p.user,
}));

const clearUser = createAction<void, State>("ClearUser").withState((s) => ({ ...s, user: null }));

// Avoid - too many concerns
const setUserAndClearCacheAndNotify = createAction<{ user: User }, State>("Everything").withState(
  (s, p) => {
    // Complex update
  }
);
```

### Descriptive Action Names

Use clear, descriptive action names:

```ts
// Good
const markTodoComplete = createAction<{ id: number }, State>("MarkTodoComplete").withState(
  (s, p) => ({ ...s, todos: s.todos.map((t) => (t.id === p.id ? { ...t, complete: true } : t)) })
);

// Avoid
const doit = createAction<{ id: number }, State>("Doit");
```

## See Also

- [Async Actions](12-async-actions.md) - Handling asynchronous operations
- [State Definitions](10-state-definitions.md) - State structure
- [Middleware](21-middleware.md) - Extending dispatch behavior
