---
category: Getting Started
alias: architecture
title: Architecture
description: Understand the internal design of Tagix
---

## Store Structure

The store is the central component that manages state and dispatches:

```ts
class TagixStore<S extends { readonly _tag: string }> {
  // Current state (getter)
  readonly stateValue: S;

  // Store metadata
  readonly name: string;
  readonly registeredActions: readonly string[];

  // Core operations
  dispatch(type: string, payload?: unknown): Promise<void> | void;
  subscribe(callback: (state: S) => void): () => void;
  fork(): TagixStore<S>;

  // Query operations
  select<K extends keyof S>(key: K): S[K];
  isInState(tag: string): boolean;
  getState<T extends S["_tag"]>(tag: T): Extract<S, { _tag: T }> | null;
}
```

## State Definition

State is defined using `taggedEnum`, which creates a type with discriminated variants:

```ts
const AppState = taggedEnum({
  Idle: {},
  Loading: { progress: number },
  Ready: { data: unknown },
  Error: { message: string },
});

// Creates:
// - AppState type with _tag property
// - Constructor functions (AppState.Idle(), etc.)
// - State union type (AppState.State)
```

## Action Flow

1. **Action Creation**: Define action type, payload, and state handler
2. **Registration**: Register action with store
3. **Dispatch**: Call `store.dispatch(type, payload)`
4. **Middleware**: Optional middleware intercepts the action
5. **Execution**: State handler produces new state
6. **Notification**: Subscribers receive updated state

```ts
const increment = createAction<{ amount: number }, State>("Increment")
  .withPayload({ amount: 1 })
  .withState((state, payload) => ({ ...state, value: state.value + payload.amount }));

store.register("Increment", increment);
store.dispatch("tagix/action/Increment", { amount: 5 });
```

## Dispatch Patterns

### String-Based Dispatch

```ts
store.dispatch("tagix/action/Increment", { amount: 5 });
```

### Action Creator Dispatch

```ts
const increment = (amount: number) => createAction("Increment").withPayload({ amount });

store.dispatch(increment, { amount: 5 });
```

### Async Dispatch

```ts
const fetchData = createAsyncAction("FetchData")
  .state((s) => ({ ...s, _tag: "Loading" }))
  .effect(async () => await fetch("/api/data").then((r) => r.json()))
  .onSuccess((s, data) => ({ ...s, _tag: "Ready", data }));

await store.dispatch(fetchData);
```

## Middleware Chain

Middleware forms a chain that each action passes through:

```ts
const logging = () => (next) => (action) => {
  console.log(action.type);
  return next(action);
};

const store = createStore(initial, state, {
  middlewares: [logging, analytics, throttle],
});
```

## Forking

Create isolated store copies for testing or isolated branches:

```ts
const mainStore = createStore(initialState, state);
const fork = mainStore.fork();

// Changes to fork don't affect mainStore
fork.dispatch("Action", payload);
```
