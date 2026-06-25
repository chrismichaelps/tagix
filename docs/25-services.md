---
category: Features
alias: services
title: Services
description: Manage application services and dependencies with type-safe service tags
---

# Services

Services are reusable components that provide shared functionality across your application. They handle operations like database access, API calls, logging, and caching. Services keep your business logic clean by separating side effects from state transitions.

Tagix provides a powerful service system with type-safe tags, service registries, and deep integration with actions, context, and hooks.

## Design Philosophy

Tagix services follow these principles:

1. **Single Source of Truth** - Service definitions live in dedicated files, exported from a central registry
2. **Type Safety First** - Services are checked at compile time
3. **Context Integration** - Services work with the existing context system
4. **Consistent API** - Same patterns as the rest of Tagix

## Creating Services

### Step 1: Define Service Tags

Create a service tag in its own file:

```ts
// services/api/database.ts
import { createServiceTag } from "tagix";

export interface DatabaseService {
  findUser(id: string): Promise<User | null>;
  createUser(user: CreateUserInput): Promise<User>;
  updateUser(id: string, data: UpdateUserInput): Promise<User>;
  deleteUser(id: string): Promise<void>;
  listUsers(): Promise<User[]>;
}

export const Database = createServiceTag<DatabaseService>("Database");
```

### Step 2: Create the Registry

The registry is your single source of truth:

```ts
// services/registry.ts
import { createServiceRegistry } from "tagix";
import { Database, type DatabaseService } from "./api/database";
import { Logger, type LoggerService } from "./api/logger";
import { Cache, type CacheService } from "./api/cache";

export interface ServiceRegistry {
  database: typeof Database;
  logger: typeof Logger;
  cache: typeof Cache;
}

export type ServiceImplementations = {
  database: DatabaseService;
  logger: LoggerService;
  cache: CacheService;
};

export const services = createServiceRegistry({
  database: Database,
  logger: Logger,
  cache: Cache,
});

export { Database, Logger, Cache };
export type { DatabaseService, LoggerService, CacheService };
```

### Step 3: Implement Services

Create implementations in separate files:

```ts
// services/implementations/api_database.ts
import type { DatabaseService } from "../api/database";

export const createDatabase = (baseUrl: string): DatabaseService => ({
  async findUser(id) {
    const response = await fetch(`${baseUrl}/users/${id}`);
    if (!response.ok) return null;
    return response.json();
  },

  async createUser(user) {
    const response = await fetch(`${baseUrl}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(user),
    });
    return response.json();
  },

  async updateUser(id, data) {
    const response = await fetch(`${baseUrl}/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return response.json();
  },

  async deleteUser(id) {
    await fetch(`${baseUrl}/users/${id}`, { method: "DELETE" });
  },

  async listUsers() {
    const response = await fetch(`${baseUrl}/users`);
    return response.json();
  },
});
```

```ts
// services/implementations/console_logger.ts
import type { LoggerService } from "../api/logger";

export const createLogger = (prefix?: string): LoggerService => ({
  info: (message) => console.log(`[${prefix ?? "APP"}] INFO:`, message),
  warn: (message) => console.warn(`[${prefix ?? "APP"}] WARN:`, message),
  error: (message) => console.error(`[${prefix ?? "APP"}] ERROR:`, message),
});
```

### Step 4: Provide Services to Context

```ts
import { createContext, createStore } from "tagix";
import { services, Database, Logger } from "./services/registry";
import { createDatabase } from "./services/implementations/api_database";
import { createLogger } from "./services/implementations/console_logger";

const store = createStore(initialState, AppState);
const context = createContext(store)
  .provideService(services.database, createDatabase("https://api.example.com"))
  .provideService(services.logger, createLogger("MyApp"));
```

## Using Services in Actions

### Synchronous Actions

```ts
import { createAsyncAction } from "tagix";
import { Database, Logger } from "./services/registry";

// `withHandler` runs synchronously, so any awaited service call (database,
// network) must go through `createAsyncAction().effect(...)`, not `withHandler`.
// Async payload types come from the generic parameters, not a `withPayload`
// call: `createAsyncAction<Payload, State, EffectResult>("Name")`.
const createUser = createAsyncAction<{ name: string; email: string }, AppState, User>("CreateUser")
  .state((s) => ({ ...s, _tag: "Loading" }))
  .effect(async (payload, context) => {
    const db = context.getService(Database);
    const logger = context.getService(Logger);

    logger.info(`Creating user: ${payload.email}`);

    return db.createUser({ name: payload.name, email: payload.email });
  })
  .onSuccess((state, user) => ({ ...state, _tag: "Ready", user }))
  .onError((state, error) => ({ ...state, _tag: "Error", message: error.message }));
```

### Async Actions

```ts
import { createAsyncAction } from "tagix";
import { Database, Logger } from "./services/registry";

const fetchUser = createAsyncAction<{ id: string }, AppState, User>("FetchUser")
  .state((s) => ({ ...s, _tag: "Loading" }))
  .effect(async (payload, context) => {
    const db = context.getService(Database);
    const logger = context.getService(Logger);

    logger.info(`Fetching user: ${payload.id}`);

    const user = await db.findUser(payload.id);

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  })
  .onSuccess((state, user) => ({
    ...state,
    _tag: "Ready",
    user,
  }))
  .onError((state, error) => ({
    ...state,
    _tag: "Error",
    message: error.message,
  }));
```

### With Action Groups

```ts
import { createActionGroup } from "tagix";
import { Database, Logger } from "./services/registry";

const users = createActionGroup("Users", {
  fetch: createAsyncAction<{ id: string }, AppState, User>("Fetch")
    .state((s) => ({ ...s, _tag: "Loading" }))
    .effect(async (payload, context) => {
      const db = context.getService(Database);
      return db.findUser(payload.id);
    })
    .onSuccess((state, user) => ({ ...state, user, _tag: "Ready" }))
    .onError((state, error) => ({ ...state, error: error.message, _tag: "Error" })),

  // Awaited service calls require `createAsyncAction` (effect), not `withHandler`.
  create: createAsyncAction<{ name: string; email: string }, AppState, User>("Create")
    .state((s) => ({ ...s, _tag: "Loading" }))
    .effect(async (payload, context) => {
      const db = context.getService(Database);
      return db.createUser(payload);
    })
    .onSuccess((state, user) => ({ ...state, user, _tag: "Ready" }))
    .onError((state, error) => ({ ...state, error: error.message, _tag: "Error" })),

  delete: createAsyncAction<{ id: string }, AppState, void>("Delete")
    .state((s) => ({ ...s, _tag: "Loading" }))
    .effect(async (payload, context) => {
      const db = context.getService(Database);
      await db.deleteUser(payload.id);
    })
    .onSuccess((state) => ({ ...state, user: null, _tag: "Idle" }))
    .onError((state, error) => ({ ...state, error: error.message, _tag: "Error" })),
});
```

## Using Services in Components

### Hooks

```tsx
import { useService, useServiceOptional } from "tagix";
import { Database, Logger } from "./services/registry";

function UserProfile({ context, userId }: { context: TagixContext; userId: string }) {
  const db = useService(context, Database);
  const logger = useService(context, Logger);
  const analytics = useServiceOptional(context, Analytics); // Optional

  const handleLoad = async () => {
    logger.info(`Loading profile ${userId}`);
    const user = await db.findUser(userId);
    analytics?.track("profile_loaded", { userId });
  };

  return <button onClick={handleLoad}>Load User</button>;
}
```

### Direct Context Access

```ts
function Component() {
  const db = context.getService(Database);
  const user = await db.findUser("123");
  // ...
}
```

## Optional Services

Some services might not always be available:

```ts
const getUser = createAsyncAction<{ id: string }, AppState, User>("GetUser")
  .state((s) => ({ ...s, _tag: "Loading" }))
  .effect(async (payload, context) => {
    const cache = context.getServiceOptional(Cache);

    // Try cache first
    if (cache) {
      const cached = await cache.get(`user:${payload.id}`);
      if (cached) {
        return cached;
      }
    }

    // Fallback to database
    const db = context.getService(Database);
    const user = await db.findUser(payload.id);

    // Update cache
    if (cache && user) {
      await cache.set(`user:${payload.id}`, user, 3600);
    }

    return user;
  })
  .onSuccess((state, user) => ({ ...state, _tag: "Ready", user }))
  .onError((state, error) => ({ ...state, _tag: "Error", message: error.message }));
```

## Service Factories with Configuration

```ts
// services/config.ts
export interface ServiceConfig {
  apiUrl: string;
  logLevel: "debug" | "info" | "warn" | "error";
  cacheTTL: number;
}

export const createServiceImplementations = (config: ServiceConfig) => ({
  database: createDatabase(config.apiUrl),
  logger: createLogger(config.logLevel),
  cache: createCache(config.cacheTTL),
});

// Usage
const config: ServiceConfig = {
  apiUrl: "https://api.example.com",
  logLevel: "info",
  cacheTTL: 3600,
};

const implementations = createServiceImplementations(config);

const context = createContext(store)
  .provideService(services.database, implementations.database)
  .provideService(services.logger, implementations.logger)
  .provideService(services.cache, implementations.cache);
```

## Testing

### Unit Testing Actions

```ts
import { createContext, createStore } from "tagix";
import { Database, Logger } from "./services/registry";

const mockDatabase: DatabaseService = {
  async findUser(id) {
    return { id, name: "Test User", email: "test@example.com" };
  },
  async createUser(user) {
    return { id: "new-id", ...user };
  },
  async updateUser(id, data) {
    return { id, ...data };
  },
  async deleteUser(id) {},
  async listUsers() {
    return [];
  },
};

const mockLogger: LoggerService = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

const testContext = createContext(createStore(initialState, AppState))
  .provideService(Database, mockDatabase)
  .provideService(Logger, mockLogger);

testContext.dispatch(action, payload);

expect(mockLogger.info).toHaveBeenCalledWith("Creating user: test@example.com");
```

### Integration Testing

```ts
describe("UserActions", () => {
  let context: TagixContext;
  let store: TagixStore;

  beforeEach(() => {
    store = createStore(UserState.Idle({}), UserState);
    context = createContext(store)
      .provideService(Database, createDatabase("https://test-api.example.com"))
      .provideService(Logger, createLogger("Test"));
  });

  it("should fetch and store user", async () => {
    await context.dispatch(users.fetch, { id: "123" });
    expect(store.stateValue._tag).toBe("Ready");
    expect(store.stateValue.user).toBeDefined();
  });
});
```

## API Reference

### createServiceTag

```ts
const MyService = createServiceTag<MyServiceInterface>("MyService");
```

Creates a typed service tag.

### createServiceRegistry

```ts
const services = createServiceRegistry({
  database: DatabaseTag,
  logger: LoggerTag,
  cache: CacheTag,
});
```

Creates a typed registry of service tags.

### Context.provideService

```ts
context.provideService(serviceTag, implementation);
```

Adds a service implementation to the context.

### Context.getService

```ts
const service = context.getService(serviceTag);
```

Gets a required service. Throws if not provided.

### Context.getServiceOptional

```ts
const service = context.getServiceOptional(serviceTag);
```

Gets an optional service. Returns undefined if not provided.

### useService

```ts
const service = useService(context, serviceTag);
```

Gets a service from a context. Throws if not provided. Exported from `"tagix"`.

### useServiceOptional

```ts
const service = useServiceOptional(context, serviceTag);
```

Gets an optional service from a context. Returns `undefined` if not provided.

## See Also

- [Context](22-context.md) - Context methods
- [Actions](11-actions.md) - Action creators
- [Async Actions](12-async-actions.md) - Async operations
- [Action Groups](14-action-groups.md) - Namespaced actions
- [Hooks](24-hooks.md) - Hook utilities
- [Testing](41-testing.md) - Testing strategies
