---
category: State Management
alias: async-actions
title: Async Actions
description: Handle asynchronous operations with effects, success, and error handlers
keywords:
  - async
  - effects
  - promises
  - asynchronous
sidebar:
  position: 3
  label: Async Actions
  icon: arrow-repeat
tags:
  - async
  - effects
author: Tagix Team
last_updated: 2026-02-02
version: 1.0.0
draft: false
pagination_prev: 11-actions
pagination_next: 13-state-machines
head:
  - tag: meta
    attrs:
      property: og:type
      content: article
  - tag: meta
    attrs:
      property: og:title
      content: Async Actions - Tagix
  - tag: meta
    attrs:
      property: og:description
      content: Handle async operations with effects
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

# Async Actions

Handle asynchronous operations with effects, success, and error handlers.

## Creating Async Actions

Use `createAsyncAction` for operations that involve promises:

```ts
import { createAsyncAction } from "tagix";

const fetchUser = createAsyncAction<{ id: number }, UserState, User>("FetchUser")
  .state((s) => ({ ...s, _tag: "Loading" }))
  .effect(async (payload) => {
    const response = await fetch(`/api/users/${payload.id}`);
    if (!response.ok) throw new Error("User not found");
    return response.json();
  })
  .onSuccess((s, user) => ({ ...s, _tag: "Loaded", user }))
  .onError((s, error) => ({ ...s, _tag: "Error", message: error.message }));
```

## Components

### State Handler

The initial state transition when the action starts:

```ts
.state((currentState) => ({
  ...currentState,
  _tag: "Loading",
}))
```

### Effect Handler

The asynchronous operation:

```ts
.effect(async (payload) => {
  const result = await someAsyncOperation(payload);
  return result; // This becomes the success payload
})
```

### onSuccess Handler

Called when the effect resolves:

```ts
.onSuccess((currentState, result) => ({
  ...currentState,
  _tag: "Ready",
  data: result,
}))
```

### onError Handler

Called when the effect rejects:

```ts
.onError((currentState, error) => ({
  ...currentState,
  _tag: "Error",
  message: error instanceof Error ? error.message : "Unknown error",
}))
```

## Complete Example

```ts
const fetchPosts = createAsyncAction<void, PostsState, Post[]>("FetchPosts")
  .state(() => PostsState.Loading({}))
  .effect(async () => {
    const response = await fetch("https://jsonplaceholder.typicode.com/posts");
    if (!response.ok) throw new Error("Failed to fetch");
    return response.json();
  })
  .onSuccess((_, posts) => PostsState.Loaded({ posts }))
  .onError((_, error) => PostsState.Error({ message: error.message }));

store.register("FetchPosts", fetchPosts);

// Dispatch async action
await store.dispatch(fetchPosts);
```

## Dispatching Async Actions

Async actions return promises:

```ts
// Await the result
await store.dispatch(fetchUser, { id: 1 });

// Handle errors
try {
  await store.dispatch(fetchUser, { id: 999 });
} catch (error) {
  console.error("Action failed:", error);
}
```

## Payload Flow

```
dispatch(payload)
    │
    ▼
┌─────────────┐
│   .state()  │───> Loading state
└─────────────┘
    │
    ▼
┌─────────────┐
│  .effect()  │───> Async operation
└─────────────┘
    │
    ├──────> Resolves ──> .onSuccess()
    │
    └──────> Rejects ──> .onError()
```

## Error Handling

### Structured Errors

Define error types in your state:

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

### Retry Logic

Implement retry in the effect:

```ts
const fetchWithRetry = createAsyncAction<{ id: number }, State, Data>("Fetch")
  .state((s) => ({ ...s, _tag: "Loading" }))
  .effect(async (payload, { signal }) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await fetchWithSignal(`/api/${payload.id}`, signal);
      } catch (error) {
        if (attempt === 2) throw error;
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
    throw new Error("Max retries exceeded");
  })
  .onSuccess((s, data) => ({ ...s, _tag: "Success", data }))
  .onError((s, error) => ({ ...s, _tag: "Error", message: error.message, retryable: true }));
```

## Canceling Actions

Use AbortSignal for cancellation:

```ts
const fetchData = createAsyncAction<{ id: number }, State, Data>("Fetch")
  .state((s) => ({ ...s, _tag: "Loading" }))
  .effect(async (payload, { signal }) => {
    const controller = new AbortController();
    signal.addEventListener("abort", () => controller.abort());

    const response = await fetch(`/api/${payload.id}`, {
      signal: controller.signal,
    });
    return response.json();
  })
  .onSuccess((s, data) => ({ ...s, _tag: "Success", data }))
  .onError((s, error) => ({ ...s, _tag: "Error", message: error.message }));
```

## Concurrent Actions

Multiple async actions can run concurrently:

```ts
await Promise.all([
  store.dispatch(fetchUser, { id: 1 }),
  store.dispatch(fetchPosts),
  store.dispatch(fetchNotifications),
]);
```

## Progress Tracking

Track progress for uploads or downloads:

```ts
const uploadFile = createAsyncAction<{ file: File }, UploadState, UploadResult>("UploadFile")
  .state((s) => ({ ...s, _tag: "Uploading", progress: 0 }))
  .effect(async (payload, { signal }) => {
    const formData = new FormData();
    formData.append("file", payload.file);

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formBody,
      signal,
    });

    return response.json();
  })
  .onSuccess((s, result) => ({ ...s, _tag: "Complete", result }))
  .onError((s, error) => ({ ...s, _tag: "Failed", error: error.message }));
```

## See Also

- [Actions](11-actions.md) - Synchronous actions
- [Error Handling](23-error-handling.md) - Error patterns
- [Middleware](21-middleware.md) - Request middleware
