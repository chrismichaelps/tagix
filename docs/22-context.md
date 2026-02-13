---
category: Features
alias: context
title: Context
description: Framework-agnostic store integration with sub-contexts and dependency injection
---

# Context

TagixContext wraps a store with additional features for dependency injection, sub-contexts, and framework integration. Contexts work with any framework including React, Vue, Svelte, or vanilla JavaScript.

## Creating a Context

```ts
import { createStore, createContext, taggedEnum } from "tagix";

const CounterState = taggedEnum({
  Idle: { value: 0 },
  Loading: {},
  Ready: { value: 0 },
  Error: { message: "" },
});

const store = createStore(CounterState.Idle({ value: 0 }), {
  name: "Counter",
});

const context = createContext(store);
```

You can pass configuration options when creating a context.

```ts
const context = createContext(store, {
  parent: null,
  autoCleanup: true,
  onError: (error) => console.error(error),
});
```

## Context Methods

### getCurrent

Get the current state from the context.

```ts
const state = context.getCurrent();
console.log(state._tag); // "Idle"
```

### dispatch

Dispatch an action through the context.

```ts
context.dispatch("Increment", { amount: 5 });

// Async actions return Promise
await context.dispatch("FetchData", {});
```

### subscribe

Subscribe to state changes. The callback runs immediately with the current state, then on each change.

```ts
const unsubscribe = context.subscribe((state) => {
  console.log("State changed:", state._tag);
});

unsubscribe();
```

### select

Select a value from state and subscribe to changes.

```ts
context.select(
  (state) => state.value,
  (value) => {
    console.log("Value changed:", value);
  }
);
```

### selectAsync

Get a value as a Promise.

```ts
const { promise, unsubscribe } = context.selectAsync((state) => state.value);

const value = await promise;
console.log(value);

unsubscribe();
```

### subscribeKey

Subscribe to changes of a specific state property.

```ts
context.subscribeKey("_tag", (tag) => {
  console.log("Tag changed:", tag);
});
```

### use

Access state or a selected value using a hook pattern.

```ts
// Get full state
const state = context.use();

// Get selected value
const value = context.use((state) => state.value);
```

## Dependency Injection

Contexts support dependency injection through the `provide` method. This creates sub-contexts with values that can be accessed by components.

### Provide Static Values

```ts
const userContext = context.provide("user", {
  name: "Chris",
  role: "admin",
});
```

### Provide Derived Values

```ts
const computedContext = context.provide("computed", (parent) => ({
  doubled: parent.value * 2,
  squared: parent.value ** 2,
}));
```

### Get Provided Values

```ts
const user = userContext.get<{ name: string; role: string }>("user");
if (user.isSome) {
  console.log(user.value.name); // "Chris"
}
```

## Forking and Merging

Create isolated branches of state that share the same underlying store.

### Fork

```ts
const fork = context.fork();
fork.dispatch("Increment", { amount: 10 });

console.log(context.getCurrent().value); // 10
```

Forks share the same store. Changes made in a fork propagate back to the parent context automatically.

### Clone

Create a new context with its own subscriptions but the same store.

```ts
const cloned = context.clone();
```

### Merge

Merge state from another context into this one.

```ts
const otherContext = context.fork();
otherContext.dispatch("Increment", { amount: 5 });

context.merge(otherContext);
```

## Cleanup

Clean up contexts when you are done with them.

```ts
context.dispose();

// All operations throw after disposal
context.getCurrent(); // Error
```

Contexts are automatically cleaned up when you dispose child contexts, forked contexts, and derived contexts.

## Complete Example

```ts
import { createStore, createContext, createAction, taggedEnum } from "tagix";

const CounterState = taggedEnum({
  Idle: { value: 0 },
  Loading: {},
  Ready: { value: 0 },
  Error: { message: "" },
});

const store = createStore(CounterState.Idle({ value: 0 }), {
  name: "Counter",
});

const context = createContext(store);

const increment = createAction("Increment")
  .withPayload({ amount: 1 })
  .withState((state, payload) => ({
    ...state,
    value: state.value + payload.amount,
  }));

store.register("Increment", increment);

// Subscribe to state changes
context.subscribe((state) => {
  console.log("State:", state._tag);
});

// Select specific value
context.select(
  (state) => {
    if ("value" in state && typeof state.value === "number") {
      return state.value;
    }
    return 0;
  },
  (value) => {
    console.log("Value:", value);
  }
);

// Dispatch actions
context.dispatch("Increment", { amount: 5 });
```

## Hook Utilities

Tagix provides hook utilities for framework integration.

```ts
import { useStore, useSelector, useDispatch, useSubscribe } from "tagix";

// Get current state
const state = useStore(context);

// Get derived value
const value = useSelector(context, (state) => state.value);

// Subscribe to changes
const unsubscribe = useSubscribe(context, (state) => {
  console.log("State changed:", state._tag);
});

// Get dispatch function
const dispatch = useDispatch(context);
dispatch("Increment", { amount: 1 });
```

## Error Handling

Configure custom error handling for subscription errors.

```ts
const context = createContext(store, {
  onError: (error) => {
    console.error("Context error:", error);
  },
});
```

## See Also

- [createStore](../core/factory.md) - Store creation
- [Actions](../actions/index.md) - Synchronous actions
- [Selectors](../selectors/index.md) - Selector utilities
