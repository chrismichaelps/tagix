---
category: Getting Started
alias: quickstart
title: Quick Start
description: Build your first Tagix application in under five minutes
---

# Quick Start

Build your first Tagix application in under five minutes.

## Step 1: Define State

State in Tagix must be defined as discriminated unions using `taggedEnum`:

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

The `taggedEnum` function creates:

- A type with a `_tag` property for discrimination
- Constructor functions for each state variant
- A `State` type union of all variants

## Step 2: Create Store

Instantiate a store with your initial state:

```ts
import { createStore } from "tagix";

const store = createStore(CounterState.Idle({ value: 0 }), CounterState, { name: "Counter" });
```

## Step 3: Create Actions

Actions define state transitions. Use `createAction` for synchronous updates:

```ts
import { createAction } from "tagix";

const increment = createAction<{ amount: number }, CounterStateType>("Increment")
  .withPayload({ amount: 1 })
  .withState((state, payload) => ({
    ...state,
    value: state.value + payload.amount,
  }));

const reset = createAction<void, CounterStateType>("Reset")
  .withPayload(undefined)
  .withState(() => CounterState.Idle({ value: 0 }));
```

## Step 4: Register Actions

Actions must be registered with the store before use:

```ts
store.register("Increment", increment);
store.register("Reset", reset);
```

## Step 5: Dispatch Actions

Trigger state changes through dispatch:

```ts
// Synchronous dispatch
store.dispatch("tagix/action/Increment", { amount: 5 });

// Check current state
console.log(store.stateValue._tag); // "Ready"
console.log((store.stateValue as Extract<CounterStateType, { _tag: "Ready" }>).value); // 5
```

## Step 6: Subscribe to Changes

Listen for state updates:

```ts
const unsubscribe = store.subscribe((state) => {
  console.log("State changed:", state._tag);
});

// Later, stop listening
unsubscribe();
```

## Complete Example

```ts
import { createStore, createAction, taggedEnum } from "tagix";

const CounterState = taggedEnum({
  Idle: { value: 0 },
  Loading: {},
  Ready: { value: 0 },
  Error: { message: "" },
});

type CounterStateType = typeof CounterState.State;

const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
  name: "Counter",
});

const increment = createAction<{ amount: number }, CounterStateType>("Increment")
  .withPayload({ amount: 1 })
  .withState((state, payload) => ({
    ...state,
    value: state.value + payload.amount,
  }));

store.register("Increment", increment);

store.subscribe((state) => {
  if (state._tag === "Ready") {
    console.log("Value:", state.value);
  }
});

store.dispatch("tagix/action/Increment", { amount: 10 });
// Output: Value: 10
```

## Next Steps

| Topic                                | Description                     |
| ------------------------------------ | ------------------------------- |
| [Core Concepts](03-core-concepts.md) | Understand fundamental concepts |
| [Actions](11-actions.md)             | Learn about synchronous actions |
| [Async Actions](12-async-actions.md) | Handle asynchronous operations  |
