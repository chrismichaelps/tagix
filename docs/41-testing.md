---
category: Advanced
alias: testing
title: Testing
description: Strategies for testing Tagix applications
keywords:
  - testing
  - unit tests
  - vitest
  - testing strategies
sidebar:
  position: 2
  label: Testing
  icon: beaker
tags:
  - testing
  - advanced
author: Tagix Team
last_updated: 2026-02-02
version: 1.0.0
draft: false
pagination_prev: 40-type-safety
pagination_next: null
head:
  - tag: meta
    attrs:
      property: og:type
      content: article
  - tag: meta
    attrs:
      property: og:title
      content: Testing - Tagix
  - tag: meta
    attrs:
      property: og:description
      content: Test your Tagix applications
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

# Testing

## Unit Testing Actions

Test actions in isolation:

```ts
import { describe, it, expect } from "vitest";
import { createAction } from "tagix";

const CounterState = taggedEnum({
  Idle: { value: 0 },
  Ready: { value: 0 },
});

const increment = createAction<{ amount: number }, typeof CounterState.State>("Increment")
  .withPayload({ amount: 1 })
  .withState((s, p) => ({
    ...s,
    value: s.value + p.amount,
  }));

describe("Actions", () => {
  it("should increment value", () => {
    const state = CounterState.Idle({ value: 0 });
    const nextState = increment.handler(state, { amount: 5 });
    expect(nextState.value).toBe(5);
  });

  it("should handle negative amounts", () => {
    const state = CounterState.Ready({ value: 10 });
    const nextState = increment.handler(state, { amount: -3 });
    expect(nextState.value).toBe(7);
  });
});
```

## Testing Stores

```ts
describe("Store", () => {
  it("should dispatch action", () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

    store.register("Increment", increment);
    store.dispatch("tagix/action/Increment", { amount: 5 });

    const state = store.stateValue as Extract<typeof CounterState.State, { _tag: "Ready" }>;
    expect(state.value).toBe(5);
  });

  it("should notify subscribers", () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

    let callCount = 0;
    const unsubscribe = store.subscribe(() => {
      callCount++;
    });

    store.dispatch("tagix/action/Increment", { amount: 1 });
    expect(callCount).toBe(1);

    unsubscribe();
    store.dispatch("tagix/action/Increment", { amount: 1 });
    expect(callCount).toBe(1);
  });
});
```

## Testing Async Actions

```ts
describe("Async Actions", () => {
  it("should handle async flow", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

    const asyncIncrement = createAsyncAction<{ amount: number }, typeof CounterState.State, number>(
      "AsyncIncrement"
    )
      .state((s) => ({ ...s, _tag: "Ready" }))
      .effect(async (p) => {
        await new Promise((r) => setTimeout(r, 10));
        return p.amount;
      })
      .onSuccess((s, result) => ({ ...s, value: result }));

    store.register("AsyncIncrement", asyncIncrement);

    await store.dispatch(asyncIncrement, { amount: 42 });

    const state = store.stateValue as Extract<typeof CounterState.State, { _tag: "Ready" }>;
    expect(state.value).toBe(42);
  });

  it("should handle errors", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

    const failingAction = createAsyncAction<void, typeof CounterState.State, never>("Failing")
      .state((s) => ({ ...s, _tag: "Ready" }))
      .effect(async () => {
        throw new Error("Test error");
      })
      .onSuccess((s) => s)
      .onError((s, error) => ({ ...s, _tag: "Idle" }));

    store.register("Failing", failingAction);
    await store.dispatch(failingAction);

    expect(store.stateValue._tag).toBe("Idle");
  });
});
```

## Forking for Testing

Isolate tests with forks:

```ts
describe("Fork Testing", () => {
  it("should not affect main store", () => {
    const mainStore = createStore(CounterState.Idle({ value: 0 }), CounterState);

    const fork = mainStore.fork();

    // Modify fork
    fork.dispatch("tagix/action/Increment", { amount: 100 });

    // Verify fork changed
    const forkState = fork.stateValue;
    expect(forkState.value).toBe(100);

    // Verify main store unchanged
    const mainState = mainStore.stateValue;
    expect(mainState.value).toBe(0);
  });
});
```

## Selector Testing

```ts
describe("Selectors", () => {
  const selectors = {
    getValue: (state: typeof CounterState.State) => (state._tag === "Ready" ? state.value : 0),
  };

  it("should extract value from Ready state", () => {
    const state = CounterState.Ready({ value: 42 });
    expect(selectors.getValue(state)).toBe(42);
  });

  it("should return 0 for Idle state", () => {
    const state = CounterState.Idle({ value: 0 });
    expect(selectors.getValue(state)).toBe(0);
  });
});
```

## Integration Testing

```ts
describe("Integration", () => {
  it("should handle complete workflow", async () => {
    const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

    store.register("Increment", increment);

    // Initial state
    expect(store.stateValue.value).toBe(0);

    // Dispatch multiple actions
    store.dispatch("tagix/action/Increment", { amount: 5 });
    expect(store.stateValue.value).toBe(5);

    store.dispatch("tagix/action/Increment", { amount: 3 });
    expect(store.stateValue.value).toBe(8);

    // Subscribe and verify
    const states: number[] = [];
    const unsubscribe = store.subscribe((s) => {
      if (s._tag === "Ready") states.push(s.value);
    });

    store.dispatch("tagix/action/Increment", { amount: 2 });
    expect(states).toContain(10);

    unsubscribe();
  });
});
```

## Mocking Dependencies

```ts
describe("With Mocks", () => {
  it("should use mocked API", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ json: () => ({ id: 1, name: "Test" }) });

    const fetchUser = createAsyncAction<{ id: number }, UserState, User>("Fetch")
      .state((s) => ({ ...s, _tag: "Loading" }))
      .effect(async (p) => {
        const response = await mockFetch(`/api/users/${p.id}`);
        return response.json();
      })
      .onSuccess((s, user) => ({ ...s, _tag: "Loaded", user }))
      .onError((s, error) => ({ ...s, _tag: "Error", message: error.message }));

    const store = createStore(UserState.Idle({}), UserState);
    store.register("Fetch", fetchUser);

    await store.dispatch(fetchUser, { id: 1 });

    expect(mockFetch).toHaveBeenCalledWith("/api/users/1");
  });
});
```

## See Also

- [State Definitions](10-state-definitions.md) - State for testing
- [Actions](11-actions.md) - Testing actions
- [Async Actions](12-async-actions.md) - Testing async flows
