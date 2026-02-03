---
category: Features
alias: error-handling
title: Error Handling
description: Handle errors in Tagix with structured state and actions
---

# Error Handling

Handle errors with structured error states in Tagix.

## Error States

Define error states in your taggedEnum state definition:

```ts
const ApiState = taggedEnum({
  Idle: {},
  Loading: {},
  Success: { data: unknown },
  Error: {
    code: string;
    message: string;
    retryable: boolean;
  },
});
```

## Error Handlers in Actions

### Sync Actions

Catch errors in synchronous actions:

```ts
const riskyOperation = createAction<{ input: unknown }, ApiState>("Risky")
  .withPayload({ input: null })
  .withState((state, payload) => {
    try {
      const result = process(payload.input);
      return { ...state, _tag: "Success", data: result };
    } catch (error) {
      return {
        ...state,
        _tag: "Error",
        code: "PROCESSING_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
        retryable: true,
      };
    }
  });
```

### Async Actions

Handle errors in async actions with `.onError()`:

```ts
const fetchData = createAsyncAction<{ url: string }, ApiState, Data>("Fetch")
  .state((s) => ({ ...s, _tag: "Loading" }))
  .effect(async (payload) => {
    const response = await fetch(payload.url);
    if (!response.ok) {
      throw new Error("Request failed");
    }
    return response.json();
  })
  .onSuccess((s, data) => ({ ...s, _tag: "Success", data }))
  .onError((s, error) => ({
    ...s,
    _tag: "Error",
    code: "FETCH_ERROR",
    message: error instanceof Error ? error.message : "Network error",
    retryable: true,
  }));
```

## Error Recovery

### Retry Logic

Implement retry in async action effects:

```ts
const fetchWithRetry = createAsyncAction<{ id: number }, ApiState, Data>("Fetch")
  .state((s) => ({ ...s, _tag: "Loading" }))
  .effect(async (payload, { signal }) => {
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fetch(`/api/${payload.id}`, { signal });
      } catch (error) {
        if (attempt === maxRetries) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
      }
    }
    throw new Error("Max retries exceeded");
  })
  .onSuccess((s, data) => ({ ...s, _tag: "Success", data }))
  .onError((s, error) => ({
    ...s,
    _tag: "Error",
    code: "FETCH_ERROR",
    message: error.message,
    retryable: true,
  }));
```

### Manual Retry Action

Dispatch a retry action when an error is retryable:

```ts
const retryFetch = createAction<void, ApiState>("Retry")
  .withPayload(undefined)
  .withState((s) => {
    if (s._tag !== "Error" || !s.retryable) return s;
    return { ...s, _tag: "Loading" };
  });

store.dispatch("tagix/action/Retry");
```

## See Also

- [Async Actions](12-async-actions.md) - Async operations with error handling
- [Middleware](21-middleware.md) - Error logging middleware
- [Testing](41-testing.md) - Testing error scenarios
