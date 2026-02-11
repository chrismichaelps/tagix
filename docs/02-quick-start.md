---
category: Getting Started
alias: quickstart
title: Quick Start
description: Build your first Tagix application in under five minutes
---

# Quick Start

Build a simple counter application using Tagix. This guide walks you through defining state, creating actions, and connecting everything together.

## Step 1: Install Tagix

```bash
npm install tagix
```

## Step 2: Define Your State

Tagix uses tagged unions to represent state. The `taggedEnum` function creates a complete state definition with type safety.

```ts
import { taggedEnum } from "tagix";

const CounterState = taggedEnum({
  Idle: { value: 0 },
  Loading: {},
  Ready: { value: 0 },
  Error: { message: "" },
});

type CounterStateType = typeof CounterState.State;
```

This creates constructor functions for each state variant and a union type that represents all possible states.

## Step 3: Create a Store

The store holds your application state and handles action dispatching.

```ts
import { createStore } from "tagix";

const store = createStore(CounterState.Idle({ value: 0 }), {
  name: "Counter",
});
```

The store automatically infers your state type from the initial state you provide.

## Step 4: Create Actions

Actions define how your state changes. Use `createAction` for synchronous updates.

```ts
import { createAction } from "tagix";

const increment = createAction("Increment")
  .withPayload({ amount: 1 })
  .withState((state, payload) => ({
    ...state,
    value: state.value + payload.amount,
  }));

const reset = createAction("Reset").withState(() => CounterState.Idle({ value: 0 }));
```

The action type automatically includes a namespace prefix. You do not need to specify it manually.

## Step 5: Register Actions

Actions must be registered with the store before you can dispatch them.

```ts
store.register("Increment", increment);
store.register("Reset", reset);
```

## Step 6: Dispatch Actions

Trigger state changes through dispatch.

```ts
// Dispatch using the action creator
store.dispatch(increment, { amount: 5 });

// Or dispatch by string
store.dispatch("tagix/action/Increment", { amount: 3 });

console.log(store.stateValue);
// { _tag: "Ready", value: 8 }
```

## Step 7: Subscribe to Changes

Listen for state updates throughout your application.

```ts
const unsubscribe = store.subscribe((state) => {
  console.log("State changed:", state._tag);
});

// Stop listening when you no longer need updates
unsubscribe();
```

## Complete Example

Here is the complete counter application.

```ts
import { createStore, createAction, taggedEnum } from "tagix";

const CounterState = taggedEnum({
  Idle: { value: 0 },
  Loading: {},
  Ready: { value: 0 },
  Error: { message: "" },
});

const increment = createAction("Increment")
  .withPayload({ amount: 1 })
  .withState((state, payload) => ({
    ...state,
    value: state.value + payload.amount,
  }));

const store = createStore(CounterState.Idle({ value: 0 }), {
  name: "Counter",
});

store.register("Increment", increment);

store.subscribe((state) => {
  if (state._tag === "Ready") {
    console.log("Current value:", state.value);
  }
});

store.dispatch(increment, { amount: 10 });
// Output: Current value: 10
```

## Next Steps

| Topic                                        | Description                                   |
| -------------------------------------------- | --------------------------------------------- |
| [Core Concepts](03-core-concepts.md)         | Understand the fundamental ideas behind Tagix |
| [State Definitions](10-state-definitions.md) | Learn more about tagged unions                |
| [Actions](11-actions.md)                     | Explore synchronous actions in depth          |
