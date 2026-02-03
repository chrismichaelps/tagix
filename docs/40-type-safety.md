---
category: Advanced
alias: type-safety
title: Type Safety
description: Leverage TypeScript for compile-time correctness
---

# Type Safety

Leverage TypeScript for compile-time correctness.

## Inference

Tagix provides complete type inference from state definitions:

```ts
const CounterState = taggedEnum({
  Idle: { value: 0 },
  Loading: {},
  Ready: { value: 0 },
  Error: { message: "" },
});

// All types are automatically inferred
const initial = CounterState.Idle({ value: 0 });
// Type: { readonly _tag: "Idle"; readonly value: 0 }

type CounterType = typeof CounterState.State;
// Type: { readonly _tag: "Idle"; readonly value: 0 } |
//        { readonly _tag: "Loading" } |
//        { readonly _tag: "Ready"; readonly value: 0 } |
//        { readonly _tag: "Error"; readonly message: string }
```

## Exhaustive Pattern Matching

TypeScript enforces handling all state variants:

```ts
function processState(state: CounterType) {
  switch (state._tag) {
    case "Idle":
      return state.value; // number
    case "Loading":
      return "Loading..."; // string
    case "Ready":
      return state.value; // number
    case "Error":
      return state.message; // string
    default:
      // TypeScript ensures this is unreachable
      return assertNever(state);
  }
}
```

## Extract Pattern

Get specific variant types:

```ts
import { Extract } from "tagix";

type ReadyState = Extract<CounterType, { _tag: "Ready" }>;
// ReadyState: { readonly _tag: "Ready"; readonly value: 0 }

const ready: ReadyState = CounterState.Ready({ value: 10 });
```

## Action Generics

Action payload types are inferred:

```ts
const increment = createAction<{ amount: number }, CounterType>("Increment")
  .withPayload({ amount: 1 })
  .withState((s, p) => ({ ...s, value: s.value + p.amount }));

// TypeScript knows:
// - Payload type: { amount: number }
// - State type: CounterType
// - Action type: "tagix/action/Increment"
```

## Async Action Types

Async actions infer success and error types:

```ts
const fetchUser = createAsyncAction<{ id: number }, UserState, User>("Fetch")
  .state((s) => ({ ...s, _tag: "Loading" }))
  .effect(async (payload) => {
    const response = await fetch(`/api/users/${payload.id}`);
    return response.json(); // Inferred as User
  })
  .onSuccess((s, user) => ({ ...s, _tag: "Loaded", user }))
  .onError((s, error) => ({ ...s, _tag: "Error", message: error.message }));

// Types:
// - Payload: { id: number }
// - Success result: User
// - State: UserState
```

## Narrowing with Guards

Create type guards for state variants:

```ts
const isReady = (state: CounterType): state is Extract<CounterType, { _tag: "Ready" }> => {
  return state._tag === "Ready";
};

const isError = (state: CounterType): state is Extract<CounterType, { _tag: "Error" }> => {
  return state._tag === "Error";
};

// Usage
if (isReady(state)) {
  // TypeScript knows state is Ready variant
  console.log(state.value);
}
```

## Generic Actions

Create reusable action factories:

```ts
const createCounterActions = <T extends { value: number }>(initialValue: T["value"]) => {
  const initialState = taggedEnum({
    Idle: { value: initialValue },
    Ready: { value: initialValue },
  }) as { State: T };

  const increment = createAction<{ amount: number }, T["State"]>("Increment")
    .withPayload({ amount: 1 })
    .withState((s, p) => ({
      ...s,
      value: s.value + p.amount,
    }));

  return {
    state: initialState,
    increment,
  };
};

const counter = createCounterActions(0);
```

## Type Assertions

Use type assertions sparingly when needed:

```ts
const state = store.stateValue as Extract<CounterType, { _tag: "Ready" }>;
```

## Best Practices

### Let Types Flow

Avoid manual type annotations when inference works:

```ts
// Good - inferred types
const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

// Bad - redundant annotation
const store = createStore<CounterType>(CounterState.Idle({ value: 0 }), CounterState);
```

### Use Extract for Variants

Access specific state variants cleanly:

```ts
// Good
type LoadedState = Extract<State, { _tag: "Loaded" }>;

// Avoid - fragile
const state = store.getState("Loaded") as { data: unknown };
```

### Exhaustiveness Checking

Let TypeScript catch missing cases:

```ts
function handleState(state: State) {
  switch (state._tag) {
    case "A":
      return handleA(state);
    case "B":
      return handleB(state);
    // Missing case C
    default:
      return assertNever(state);
  }
}
```

## See Also

- [State Definitions](10-state-definitions.md) - Type-safe state
- [Actions](11-actions.md) - Type-safe actions
- [Async Actions](12-async-actions.md) - Type-safe async operations
