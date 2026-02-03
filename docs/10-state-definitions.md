---
category: State Management
alias: state-definitions
title: State Definitions
description: Define your application state using tagged unions
---

# State Definitions

Define your application state using tagged unions.

## Using taggedEnum

The `taggedEnum` function creates a complete state definition with type safety:

```ts
import { taggedEnum } from "tagix";

const UserState = taggedEnum({
  Unauthenticated: {},
  Authenticating: { loading: true },
  Authenticated: {
    user: { id: number; email: string; name: string },
    token: string,
  },
  AuthError: { message: string },
});
```

## Generated Artifacts

`taggedEnum` generates:

1. **Constructors** - Create state instances
2. **State type** - Union of all variants
3. **Pattern helpers** - Type-safe state access

```ts
// Constructors
const unauthenticated = UserState.Unauthenticated({});
const authenticating = UserState.Authenticating({ loading: true });
const authenticated = UserState.Authenticated({
  user: { id: 1, email: "test@example.com", name: "Test" },
  token: "abc123",
});

// State type (inferred)
type UserStateType = typeof UserState.State;

// Type is:
// { readonly _tag: "Unauthenticated" } |
// { readonly _tag: "Authenticating"; readonly loading: boolean } |
// { readonly _tag: "Authenticated"; readonly user: {...}; readonly token: string } |
// { readonly _tag: "AuthError"; readonly message: string }
```

## Empty vs Populated Variants

Variants can have properties or be empty:

```ts
const LoadingState = taggedEnum({
  Idle: {}, // No properties
  Loading: { progress: number }, // With properties
});
```

## Nested Structures

State can contain complex nested structures:

```ts
const AppState = taggedEnum({
  Ready: {
    user: {
      profile: {
        settings: {
          theme: "light" | "dark";
          notifications: boolean;
        };
      };
    };
    posts: Array<{ id: number; title: string }>;
  },
});
```

## Type Narrowing

The `_tag` property enables exhaustive type checking:

```ts
function processUser(state: UserStateType) {
  switch (state._tag) {
    case "Unauthenticated":
      // TypeScript knows state has no user property
      return "Please log in";
    case "Authenticating":
      // TypeScript knows state.loading exists
      return state.loading ? "Loading..." : "Starting";
    case "Authenticated":
      // TypeScript knows state.user exists
      return `Hello, ${state.user.name}`;
    case "AuthError":
      // TypeScript knows state.message exists
      return state.message;
    default:
      // Exhaustiveness check
      return assertNever(state);
  }
}
```

## Extract Helper

Use `Extract` to get specific variant types:

```ts
import { Extract } from "tagix";

type AuthenticatedState = Extract<UserStateType, { _tag: "Authenticated" }>;

// AuthenticatedState is:
// {
//   readonly _tag: "Authenticated";
//   readonly user: { id: number; email: string; name: string };
//   readonly token: string;
// }
```

## Best Practices

### One State Per Domain

Create separate state definitions for different domains:

```ts
// User state
const UserState = taggedEnum({
  /* ... */
});

// Posts state
const PostsState = taggedEnum({
  /* ... */
});

// Combine in a root state
const AppState = taggedEnum({
  User: UserState,
  Posts: PostsState,
});
```

### Flatten When Possible

Avoid deeply nested structures when flat alternatives work:

```ts
// Prefer
const FormState = taggedEnum({
  Idle: {},
  Submitting: { values: Record<string, unknown> },
  Success: { data: unknown },
  Error: { errors: Record<string, string> },
});

// Over deeply nested
const DeepFormState = taggedEnum({
  Form: {
    Status: {
      Idle: {},
      Submitting: { values: Record<string, unknown> },
      // ... more nesting
    },
  },
});
```

### Meaningful Tags

Use descriptive tag names:

```ts
// Good
const StatusState = taggedEnum({
  Pending: {},
  Processing: {},
  Completed: {},
  Failed: { reason: string },
});

// Avoid
const StatusState = taggedEnum({
  One: {},
  Two: {},
  Three: {},
});
```

## See Also

- [Actions](11-actions.md) - Modifying state
- [State Machines](13-state-machines.md) - State transitions
- [Type Safety](40-type-safety.md) - TypeScript patterns
