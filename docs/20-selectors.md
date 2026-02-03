---
category: Features
alias: selectors
title: Selectors
description: Extract and derive values from state
---

# Selectors

Extract and derive values from state.

## Store Selectors

The store provides basic selection:

```ts
const store = createStore(initialState, state);

// Get specific property
const value = store.select("user");

// Check state tag
if (store.isInState("Loaded")) {
  // State is Loaded
}

// Get typed state
const loadedState = store.getState("Loaded");
if (loadedState) {
  // Access loadedState.data
}
```

## Custom Selectors

Create reusable selector functions:

```ts
const AppState = taggedEnum({
  Ready: {
    user: { name: string; email: string },
    posts: Array<{ id: number; title: string }>,
  },
  Loading: {},
});

const selectors = {
  getUser: (state: AppStateType) => {
    if (state._tag !== "Ready") return null;
    return state.user;
  },

  getUserName: (state: AppStateType) => {
    const user = selectors.getUser(state);
    return user?.name ?? "Guest";
  },

  getPostCount: (state: AppStateType) => {
    if (state._tag !== "Ready") return 0;
    return state.posts.length;
  },

  getPostTitles: (state: AppStateType) => {
    if (state._tag !== "Ready") return [];
    return state.posts.map((p) => p.title);
  },
};
```

## Using Selectors

```ts
const user = selectors.getUser(store.stateValue);
const name = selectors.getUserName(store.stateValue);
const count = selectors.getPostCount(store.stateValue);
```

## Derived Selectors

Create selectors that combine other selectors:

```ts
const derivedSelectors = {
  getUserDisplay: (state: AppStateType) => {
    const user = selectors.getUser(state);
    if (!user) return "Anonymous";
    return `${user.name} (${user.email})`;
  },

  hasPosts: (state: AppStateType) => {
    return selectors.getPostCount(state) > 0;
  },

  firstPostTitle: (state: AppStateType) => {
    const titles = selectors.getPostTitles(state);
    return titles[0] ?? null;
  },
};
```

## Memoized Selectors

For expensive computations, memoize selectors:

```ts
import { memoize } from "tagix";

const expensiveSelector = memoize((state: AppStateType) => {
  // Expensive computation
  return computeHeavyValue(state);
});
```

## Selector Composition

Build complex selectors from simple ones:

```ts
const dashboardSelectors = {
  getDashboardData: (state: AppStateType) => ({
    user: selectors.getUser(state),
    postCount: selectors.getPostCount(state),
    theme: state._tag === "Ready" ? "dark" : "light",
  }),

  isUserReady: (state: AppStateType) => {
    return selectors.getUser(state) !== null;
  },

  canCreatePost: (state: AppStateType) => {
    return selectors.getUser(state) !== null && !state._tag.startsWith("Loading");
  },
};
```

## Best Practices

### Keep Selectors Pure

Selectors should not modify state:

```ts
// Good - pure selector
const getValue = (state: State) => state.value;

// Bad - mutates state
const getValue = (state: State) => {
  state.value += 1; // Side effect!
  return state.value;
};
```

### Return Stable Types

Use nullable types for optional values:

```ts
// Good
const getUser = (state: State): User | null => {
  return state._tag === "Ready" ? state.user : null;
};
```

### Select at Component Level

Components should select only what they need:

```ts
// Good - select specific data
const userName = useTagixState((state) => (state._tag === "Ready" ? state.user.name : null));

// Bad - subscribes to entire state
const fullState = useTagixState((state) => state);
```

## See Also

- [Context](22-context.md) - Framework integration
- [Performance](42-performance.md) - Optimization techniques
