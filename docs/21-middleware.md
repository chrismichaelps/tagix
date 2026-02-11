---
category: Features
alias: middleware
title: Middleware
description: Extend dispatch behavior with middleware
---

# Middleware

Middleware intercepts actions as they flow through the store. You can use middleware to log actions, validate payloads, attach authentication tokens, implement undo/redo, or any other cross-cutting concern.

## Middleware Basics

A middleware is a function that receives store context and returns a handler chain.

```ts
const loggerMiddleware = () => (next) => (action) => {
  console.log("Action:", action.type, action.payload);
  return next(action);
};
```

The middleware receives three functions:

1. The outer function receives store context
2. The middle function receives the next middleware in the chain
3. The inner function receives the action being dispatched

## Middleware Structure

```ts
type Middleware<S> = (
  context: MiddlewareContext<S>
) => (
  next: (action: Action | AsyncAction) => boolean
) => (action: Action | AsyncAction) => boolean | void;
```

The middleware context provides access to store operations.

```ts
interface MiddlewareContext<S extends { readonly _tag: string }> {
  getState: () => S;
  dispatch: <TPayload>(type: string, payload: TPayload) => void;
  subscribe: (callback: (state: S) => void) => () => void;
}
```

## Blocking Actions

Return `false` from a middleware to block an action from continuing through the chain.

```ts
const authMiddleware = () => (next) => (action) => {
  if (action.type.includes("Private") && !isAuthenticated()) {
    console.warn("Action blocked: User not authenticated");
    return false;
  }
  return next(action);
};

const store = createStore(initialState, {
  middlewares: [authMiddleware],
});
```

For async actions, blocking prevents the effect from running entirely.

## Modifying Actions

Middleware can modify action properties before they reach the next handler.

```ts
const timestampMiddleware = () => (next) => (action) => {
  if (action.type.includes("API")) {
    action.payload = { ...action.payload, timestamp: Date.now() };
  }
  return next(action);
};
```

## Logger Middleware

Tagix includes a built-in logger middleware for development.

```ts
import { createLoggerMiddleware } from "tagix";

const store = createStore(initialState, {
  middlewares: [
    createLoggerMiddleware({
      collapsed: true,
      duration: true,
      timestamp: true,
    }),
  ],
});
```

### Logger Options

| Option            | Description                       | Default     |
| ----------------- | --------------------------------- | ----------- |
| collapsed         | Collapse log groups in console    | false       |
| duration          | Show action processing time       | true        |
| timestamp         | Include timestamp in log          | true        |
| level             | Console method to use             | "log"       |
| predicate         | Function to filter logged actions | all actions |
| stateTransformer  | Transform state before logging    | identity    |
| actionTransformer | Transform action before logging   | identity    |

```ts
// Filter which actions to log
createLoggerMiddleware({
  predicate: (action) => !action.type.includes("Heartbeat"),
});

// Transform sensitive data
createLoggerMiddleware({
  stateTransformer: (state) => ({
    ...state,
    user: { ...state.user, password: "[REDACTED]" },
  }),
});

// Different log levels
createLoggerMiddleware({ level: "info" });
createLoggerMiddleware({ level: "warn" });
createLoggerMiddleware({ level: "error" });
```

## Custom Middleware Examples

### Analytics Middleware

Track user actions for analytics.

```ts
const analyticsMiddleware = () => (next) => (action) => {
  if (action.type.startsWith("tagix/action/")) {
    trackEvent("action", {
      type: action.type,
      hasPayload: "payload" in action,
    });
  }
  return next(action);
};
```

### Throttle Middleware

Rate limit how often actions can be dispatched.

```ts
const throttleMiddleware = (ms: number) => {
  const lastCalls = new Map<string, number>();

  return () => (next) => (action) => {
    const now = Date.now();
    const last = lastCalls.get(action.type) ?? 0;

    if (now - last < ms) {
      return false;
    }

    lastCalls.set(action.type, now);
    return next(action);
  };
};

const store = createStore(initialState, {
  middlewares: [throttleMiddleware(1000)],
});
```

### Authentication Middleware

Attach authentication tokens to requests.

```ts
const authMiddleware = (getToken: () => string | null) => () => (next) => (action) => {
  if (action.type === "tagix/action/APIRequest") {
    const token = getToken();
    if (token) {
      (action as any).payload.headers = {
        ...(action as any).payload.headers,
        Authorization: `Bearer ${token}`,
      };
    }
  }
  return next(action);
};
```

### Validation Middleware

Validate action payloads before processing.

```ts
const validationMiddleware =
  (schemas: Record<string, (payload: unknown) => boolean>) => () => (next) => (action) => {
    const schema = schemas[action.type];
    if (schema && !schema(action.payload)) {
      console.warn("Invalid action payload:", action);
      return false;
    }
    return next(action);
  };
```

### Undo/Redo Middleware

Implement undo functionality.

```ts
const createUndoMiddleware = () => {
  const history: unknown[] = [];

  return () => (next) => (action) => {
    if (action.type === "tagix/action/Undo") {
      const previous = history.pop();
      if (previous) {
        store.replaceState(previous);
      }
      return false;
    }

    const previous = store.stateValue;
    const result = next(action);

    if (result !== false) {
      history.push(previous);
    }

    return result;
  };
};
```

## Combining Middleware

Middleware order matters. The first middleware in the array sees the original action, and each subsequent middleware sees the action after previous middlewares have processed it.

```ts
const store = createStore(initialState, {
  middlewares: [
    // First: Logging sees the original action
    createLoggerMiddleware(),

    // Second: Analytics sees logged action
    analyticsMiddleware(),

    // Third: Validation validates action
    validationMiddleware(schemas),

    // Fourth: Throttling applies rate limiting
    throttleMiddleware(1000),

    // Last: Store receives fully processed action
  ],
});
```

## Disable for Production

Only use the logger middleware during development.

```ts
const logger =
  process.env.NODE_ENV === "development" ? createLoggerMiddleware({ collapsed: true }) : undefined;

const store = createStore(initialState, {
  middlewares: logger ? [logger] : [],
});
```

## See Also

- [Actions](11-actions.md) - How actions flow through the system
- [Async Actions](12-async-actions.md) - Middleware with async actions
- [Error Handling](23-error-handling.md) - Error handling in middleware
