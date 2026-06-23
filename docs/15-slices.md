---
category: State Management
alias: slices
title: Slices
description: Low-boilerplate stores with colocated transitions and bound, typed dispatchers
---

# Slices

`createSlice` colocates your state and its transitions in one declaration, auto-registers them, and hands back bound, fully-typed action dispatchers. It's the low-ceremony way to build a store — in the spirit of Redux Toolkit's `createSlice`, Pinia's `defineStore`, and Zustand's store actions — while keeping tagix's tagged-union state and explicit transitions.

## The boilerplate it removes

The building-block API is explicit but verbose — create the store, create each action, register it, then dispatch it (often by string):

```ts
const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

const increment = createAction<{ amount: number }, CounterStateType>("Increment").withState(
  (s, p) => CounterState.Ready({ value: s.value + p.amount })
);
store.register("Increment", increment);

store.dispatch("Increment", { amount: 5 }); // stringly-typed
store.dispatch(increment, { amount: 5 }); // or by reference
```

With `createSlice` the same store is one declaration, and you call the actions directly:

```ts
import { createSlice, taggedEnum } from "tagix";

const CounterState = taggedEnum({ Idle: { value: 0 }, Ready: { value: 0 } });

const counter = createSlice({
  state: CounterState.Idle({ value: 0 }),
  schema: CounterState,
  actions: {
    increment: (s, p: { amount: number }) => CounterState.Ready({ value: s.value + p.amount }),
    reset: () => CounterState.Idle({ value: 0 }),
  },
});

counter.actions.increment({ amount: 5 }); // fully typed — payload required
counter.actions.reset(); // fully typed — no payload
```

Each transition's payload type is inferred and flows into the matching dispatcher: a transition that declares a payload becomes `(payload: P) => void`, and one that takes only the state becomes `() => void`. Misusing a payload is a compile error.

## How it compares

| Library                     | Colocation             | Bound typed actions   | State model          |
| --------------------------- | ---------------------- | --------------------- | -------------------- |
| Redux Toolkit `createSlice` | ✅ reducers + actions  | ✅ generated creators | Immer drafts         |
| Zustand `create`            | ✅ state + actions     | ✅ methods on store   | plain object + `set` |
| Pinia `defineStore`         | ✅ state + actions     | ✅ store methods      | reactive object      |
| **tagix `createSlice`**     | ✅ state + transitions | ✅ `slice.actions.*`  | **tagged unions**    |

tagix keeps what the others trade away: state is a discriminated union, so every value is an explicit, exhaustively-matchable variant — you get the low boilerplate _and_ the type-level guarantees.

## Working with the store

`slice.store` is a normal store — use it for selectors, subscriptions, and framework integration:

```ts
counter.store.select((s) => s.value); // type-safe selector
const stop = counter.store.subscribe((s) => render(s));

// Actions are registered, so string/reference dispatch still works:
counter.store.dispatch("increment", { amount: 1 });
```

Pass store options via `config`:

```ts
const counter = createSlice({
  state: CounterState.Idle({ value: 0 }),
  schema: CounterState,
  actions: {
    /* ... */
  },
  config: { name: "counter", strict: true },
});
```

## Async side effects

Slice transitions are synchronous (like Redux reducers). For asynchronous work, register a [`createAsyncAction`](12-async-actions.md) on the slice's store:

```ts
const users = createSlice({
  state: UserState.Idle({}),
  schema: UserState,
  actions: {
    clear: () => UserState.Idle({}),
  },
});

const fetchUser = createAsyncAction<{ id: string }, UserStateType, User>("FetchUser")
  .state((s) => ({ ...s, _tag: "Loading" }))
  .effect((p, ctx) => ctx.getService(Api).getUser(p.id))
  .onSuccess((s, user) => ({ ...s, _tag: "Ready", user }))
  .onError((s, error) => ({ ...s, _tag: "Error", message: String(error) }));

users.store.register("FetchUser", fetchUser);
```

## API Reference

### createSlice(config)

| Field     | Description                                                                               |
| --------- | ----------------------------------------------------------------------------------------- |
| `state`   | The initial state (a variant of the tagged union).                                        |
| `schema`  | The tagged-enum constructor for the state.                                                |
| `actions` | A record of named synchronous transitions `(state, payload?) => nextState`.               |
| `config`  | Optional [store configuration](21-middleware.md) (`name`, `strict`, `middlewares`, etc.). |

Returns a `Slice` with:

- `store` — the underlying `TagixStore`.
- `actions` — bound, typed dispatchers, one per transition.

## See Also

- [Actions](11-actions.md) — the underlying action builders
- [Async Actions](12-async-actions.md) — side effects on a slice's store
- [Selectors](20-selectors.md) — reading from `slice.store`
