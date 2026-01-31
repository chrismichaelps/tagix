---
category: State Management
---

<p align="center">
  <img src="../../../public/tagix-logo.png" alt="Tagix Logo" width="50%" />
</p>

# createStore

Create a Tagix store instance for managing application state with built-in history, subscriptions, and middleware support.

## Usage

```ts
import { createStore, taggedEnum } from "tagix";

const CounterState = taggedEnum({
  Idle: { value: 0 },
  Loading: {},
  Ready: { value: 0 },
  Error: { message: "" },
});

const store = createStore(CounterState.Idle({ value: 0 }));
```

## API

### Constructor

```ts
createStore(initialState, config?)
```

#### Parameters

- **initialState**: The starting state (created via `taggedEnum`)
- **config** (optional): Store configuration

```ts
const store = createStore(CounterState.Idle({ value: 0 }), {
  name: "Counter",
  strict: false,
  maxUndoHistory: 100,
  maxSnapshots: 10,
  middlewares: [logger],
});
```

### Properties

| Property            | Type                   | Description                     |
| ------------------- | ---------------------- | ------------------------------- |
| `stateValue`        | `S`                    | Current state (getter)          |
| `name`              | `string`               | Store name                      |
| `registeredActions` | `readonly string[]`    | List of registered action types |
| `snapshotNames`     | `readonly string[]`    | Available snapshot names        |
| `canUndo()`         | `boolean`              | Can undo to previous state      |
| `canRedo()`         | `boolean`              | Can redo to next state          |
| `errorHistory`      | `readonly unknown[]`   | All recorded errors             |
| `lastError`         | `unknown \| undefined` | Most recent error               |

### Methods

#### dispatch(type, payload)

Dispatch an action by type.

```ts
store.dispatch("tagix/action/Increment", { amount: 5 });

// Returns Promise<void> for async actions
await store.dispatch("tagix/action/FetchData", {});
```

#### register(type, action)

Register an action with the store.

```ts
const increment = createAction("Increment")
  .withPayload({ amount: 1 })
  .withState((s, p) => ({ ...s, value: s.value + p.amount }));

store.register("Increment", increment);
```

#### subscribe(callback)

Subscribe to state changes.

```ts
const unsubscribe = store.subscribe((state) => {
  console.log("State changed:", state);
});

// Later, unsubscribe
unsubscribe();
```

#### undo() / redo()

Time-travel through state history.

```ts
store.dispatch("tagix/action/Increment", { amount: 1 });
store.dispatch("tagix/action/Increment", { amount: 1 });

store.undo(); // Goes back one state
store.redo(); // Goes forward one state
```

#### snapshot(name) / restore(name)

Save and restore named snapshots.

```ts
store.snapshot("before-login");

store.dispatch("tagix/action/Login", {});
// ... something goes wrong
store.restore("before-login");
```

#### isInState(tag)

Check if current state matches a tag.

```ts
if (store.isInState("Ready")) {
  // State is Ready
}
```

#### getState(tag)

Get state wrapped in Option if tag matches.

```ts
const readyState = store.getState("Ready");
if (readyState.isSome) {
  // Access readyState.value
}
```

#### select(key)

Get specific state property.

```ts
const value = store.select("value");
```

#### transitions(transitions)

Create a transition handler for state machines.

```ts
const handleTransition = store.transitions({
  Idle: (s) => ({ ...s, _tag: "Loading" }),
  Loading: (s) => ({ ...s, _tag: "Ready" }),
  Ready: (s) => ({ ...s, _tag: "Idle" }),
});
```

## Configuration

```ts
interface StoreConfig<S> {
  name?: string; // Store name for debugging
  strict?: boolean; // Enforce valid state transitions
  maxErrorHistory?: number; // Max errors to track (default: 50)
  maxSnapshots?: number; // Max named snapshots (default: 10)
  maxUndoHistory?: number; // Max undo steps (default: 100)
  middlewares?: Middleware[]; // Custom middleware chain
}
```

## Example: Complete Store

```ts
import {
  createStore,
  createAction,
  createAsyncAction,
  taggedEnum,
  createLoggerMiddleware,
} from "tagix";

const CounterState = taggedEnum({
  Idle: { value: 0 },
  Loading: {},
  Ready: { value: 0 },
  Error: { message: "" },
});

const store = createStore(CounterState.Idle({ value: 0 }), {
  name: "Counter",
  middlewares: [createLoggerMiddleware({ collapsed: true })],
});

const increment = createAction("Increment")
  .withPayload({ amount: 1 })
  .withState((s, p) => ({ ...s, value: s.value + p.amount }));

store.register("Increment", increment);

store.subscribe((state) => {
  console.log("Counter:", state.value);
});

store.dispatch("tagix/action/Increment", { amount: 5 });
```

## Related

- [createAction](../actions/index.ts) - Synchronous actions
- [createAsyncAction](../actions/index.ts) - Async actions
- [taggedEnum](../../lib/Data/tagged-enum.ts) - State definitions
- [createLoggerMiddleware](../middlewares/logger.ts) - Logging middleware
