---
category: Features
alias: middleware
title: Middleware
description: Extend dispatch behavior with middleware
keywords:
  - middleware
  - dispatch
  - extension
sidebar:
  position: 2
  label: Middleware
  icon: plugins
tags:
  - middleware
  - features
author: Tagix Team
last_updated: 2026-02-02
version: 1.0.0
draft: false
pagination_prev: 20-selectors
pagination_next: 22-context
head:
  - tag: meta
    attrs:
      property: og:type
      content: article
  - tag: meta
    attrs:
      property: og:title
      content: Middleware - Tagix
  - tag: meta
    attrs:
      property: og:description
      content: Extend dispatch with middleware
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

# Middleware

## Middleware Basics

## Creating Middleware

A middleware is a function that returns a chain handler:

```ts
const loggerMiddleware = () => (next) => (action) => {
  console.log("Action:", action.type, action.payload);
  return next(action);
};
```

## Middleware Structure

```ts
type Middleware<S> = (
  context: MiddlewareContext<S>
) => (
  next: (action: Action | AsyncAction) => boolean
) => (action: Action | AsyncAction) => boolean | void;
```

## Built-in Middleware

### Logger Middleware

Log all actions and state changes:

```ts
import { createLoggerMiddleware } from "tagix";

const store = createStore(initial, state, {
  middlewares: [
    createLoggerMiddleware({
      collapsed: true, // Collapse log groups
      duration: true, // Show timing
      timestamp: true, // Include timestamp
    }),
  ],
});
```

## Custom Middleware Examples

### Analytics Middleware

Track user actions:

```ts
const analyticsMiddleware = () => (next) => (action) => {
  if (action.type.startsWith("tagix/action/")) {
    // Send to analytics
    trackEvent("action", {
      type: action.type,
      hasPayload: "payload" in action,
    });
  }
  return next(action);
};
```

### Throttle Middleware

Rate limit actions:

```ts
const throttleMiddleware = (ms: number) => {
  const lastCalls = new Map<string, number>();

  return () => (next) => (action) => {
    const now = Date.now();
    const last = lastCalls.get(action.type) ?? 0;

    if (now - last < ms) {
      return false; // Skip action
    }

    lastCalls.set(action.type, now);
    return next(action);
  };
};

const store = createStore(initial, state, {
  middlewares: [throttleMiddleware(1000)],
});
```

### Authentication Middleware

Attach auth tokens to requests:

```ts
const authMiddleware = (getToken: () => string | null) => () => (next) => (action) => {
  if (action.type === "tagix/action/APIRequest") {
    const token = getToken();
    if (token) {
      // Attach token to request
      (action as any).payload.headers = {
        ...(action as any).payload.headers,
        Authorization: `Bearer ${token}`,
      };
    }
  }
  return next(action);
};
```

### Undo/Redo Middleware

Implement undo functionality:

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

    // Store previous state before action
    const previous = store.stateValue;
    const result = next(action);

    if (result !== false) {
      history.push(previous);
    }

    return result;
  };
};
```

### Validation Middleware

Validate actions before processing:

```ts
const validationMiddleware =
  (schemas: Record<string, (payload: unknown) => boolean>) => () => (next) => (action) => {
    const schema = schemas[action.type];
    if (schema && !schema(action.payload)) {
      console.warn("Invalid action payload:", action);
      return false; // Block action
    }
    return next(action);
  };
```

## Combining Middleware

Middleware order matters:

```ts
const store = createStore(initial, state, {
  middlewares: [
    // First: Logging (sees original action)
    createLoggerMiddleware(),

    // Second: Analytics (sees logged action)
    analyticsMiddleware(),

    // Third: Validation (validates action)
    validationMiddleware(schemas),

    // Fourth: Throttling (applies rate limiting)
    throttleMiddleware(1000),

    // Last: Store receives processed action
  ],
});
```

## Blocking Actions

Return `false` to block an action:

```ts
const blockingMiddleware = () => (next) => (action) => {
  if (action.type === "tagix/action/DeleteAll") {
    const confirm = window.confirm("Delete everything?");
    if (!confirm) return false;
  }
  return next(action);
};
```

For async actions, blocking prevents the effect from running.

## See Also

- [Actions](11-actions.md) - Action flow
- [Async Actions](12-async-actions.md) - Async middleware
- [Error Handling](23-error-handling.md) - Error middleware
