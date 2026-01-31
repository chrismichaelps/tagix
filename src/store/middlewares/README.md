---
category: State Management
---

<p align="center">
  <img src="../../../public/tagix-logo.png" alt="Tagix Logo" width="50%" />
</p>

# createLoggerMiddleware

Custom logging middleware for Tagix stores. Logs actions, state changes, and timing information.

## Usage

```ts
import { createStore, createLoggerMiddleware, createAction, taggedEnum } from "tagix";

const CounterState = taggedEnum({
  Idle: { value: 0 },
  Ready: { value: 0 },
});

const store = createStore(CounterState.Idle({ value: 0 }), {
  name: "Counter",
  middlewares: [createLoggerMiddleware()],
});

const increment = createAction("Increment")
  .withPayload({ amount: 1 })
  .withState((s, p) => ({ ...s, value: s.value + p.amount }));

store.register("Increment", increment);
store.dispatch("tagix/action/Increment", { amount: 5 });
```

**Console Output:**

```
action tagix/action/Increment @ 10:30:45.123
 action  {
   type: 'tagix/action/Increment',
   payload: { amount: 1 },
   handler: [Function]
 }
 (in 4.00 ms)
```

## API

### createLoggerMiddleware(options?)

Create a logger middleware instance.

```ts
const logger = createLoggerMiddleware({
  collapsed?: boolean | ((action) => boolean)
  duration?: boolean
  timestamp?: boolean
  level?: 'log' | 'warn' | 'error' | 'info'
  diff?: boolean
  predicate?: (action) => boolean
  stateTransformer?: (state) => transformedState
  actionTransformer?: (action) => transformedAction
})
```

## Options

### collapsed

Collapse the log group in console.

```ts
createLoggerMiddleware({ collapsed: true });
```

Or provide a function to conditionally collapse:

```ts
createLoggerMiddleware({
  collapsed: (action) => action.type.includes("Batch"),
});
```

### duration

Show action processing duration.

```ts
createLoggerMiddleware({ duration: true }); // Default: true
// Output: (in 4.00 ms)
```

### timestamp

Include timestamp in log.

```ts
createLoggerMiddleware({ timestamp: true }); // Default: true
// Output: action Increment @ 10:30:45.123
```

### level

Set console log level.

```ts
createLoggerMiddleware({ level: "info" }); // console.info
createLoggerMiddleware({ level: "warn" }); // console.warn
createLoggerMiddleware({ level: "error" }); // console.error
createLoggerMiddleware({ level: "log" }); // console.log (default)
```

### diff

Show state diff before/after action.

```ts
createLoggerMiddleware({ diff: true });
// Output includes:
// diff: { prev: {...}, next: {...} }
```

### predicate

Filter which actions to log.

```ts
createLoggerMiddleware({
  predicate: (action) => !action.type.includes("DEBUG"),
});
```

### stateTransformer

Transform state before logging (e.g., for sensitive data).

```ts
createLoggerMiddleware({
  stateTransformer: (state) => ({
    ...state,
    user: { ...state.user, password: "[REDACTED]" },
  }),
});
```

### actionTransformer

Transform action before logging.

```ts
createLoggerMiddleware({
  actionTransformer: (action) => ({
    ...action,
    payload: { ...action.payload, token: "[HIDDEN]" },
  }),
});
```

## Complete Example

```ts
import {
  createStore,
  createLoggerMiddleware,
  createAction,
  createAsyncAction,
  taggedEnum,
} from "tagix";

const AppState = taggedEnum({
  Idle: {},
  Loading: {},
  Success: { data: null },
  Error: { message: "" },
});

const store = createStore(AppState.Idle(), {
  name: "App",
  middlewares: [
    createLoggerMiddleware({
      collapsed: true,
      duration: true,
      level: "info",
      predicate: (action) => !action.type.includes("Heartbeat"),
    }),
  ],
});

const fetchData = createAsyncAction("FetchData")
  .state((s) => ({ ...s, _tag: "Loading" }))
  .effect(async () => {
    const response = await fetch("/api/data");
    return response.json();
  })
  .onSuccess((s, data) => ({ ...s, _tag: "Success", data }))
  .onError((s, error) => ({ ...s, _tag: "Error", message: error.message }));

store.register("FetchData", fetchData);
await store.dispatch("tagix/action/FetchData", {});
```

## Disable for Production

```ts
const logger =
  process.env.NODE_ENV === "development" ? createLoggerMiddleware({ collapsed: true }) : undefined;

const store = createStore(initialState, {
  name: "App",
  middlewares: logger ? [logger] : [],
});
```

## Multiple Middlewares

Combine logger with other middleware:

```ts
import { createStore, createLoggerMiddleware, createPersistenceMiddleware } from "tagix";

const store = createStore(initialState, {
  name: "App",
  middlewares: [
    createLoggerMiddleware({ collapsed: true }),
    createPersistenceMiddleware({ key: "app-state" }),
    createAnalyticsMiddleware(),
  ],
});
```

## Related

- [createStore](../core/factory.ts) - Store configuration
- [createAction](../actions/index.ts) - Action logging
- [createAsyncAction](../actions/index.ts) - Async action logging
