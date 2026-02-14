/*
MIT License

Copyright (c) 2026 Chris M. (Michael) Pérez

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createServiceTag, createServiceRegistry } from "../index";
import { createContext, createStore, createAction, taggedEnum } from "../../../index";

interface TestService {
  value: string;
  getValue(): string;
}

interface LoggerService {
  info(message: string): void;
  error(message: string): void;
}

describe("Services", () => {
  describe("createServiceTag", () => {
    it("should create a service tag with unique symbol", () => {
      const tag = createServiceTag<TestService>("TestService");
      expect(tag._name).toBe("TestService");
      expect(tag._tag).toBeTypeOf("symbol");
    });

    it("should return same tag for same name", () => {
      const tag1 = createServiceTag<TestService>("Service");
      const tag2 = createServiceTag<TestService>("Service");
      expect(tag1).toBe(tag2);
    });

    it("should support different types for same name", () => {
      const tag1 = createServiceTag<{ foo: string }>("Service");
      const tag2 = createServiceTag<{ bar: number }>("Service");
      expect(tag1).toBe(tag2);
    });
  });

  describe("createServiceRegistry", () => {
    it("should create a typed registry", () => {
      const Database = createServiceTag<{ find: () => void }>("Database");
      const Logger = createServiceTag<{ log: () => void }>("Logger");

      const registry = createServiceRegistry({
        database: Database,
        logger: Logger,
      });

      expect(registry.database).toBe(Database);
      expect(registry.logger).toBe(Logger);
    });
  });

  describe("Context service integration", () => {
    const TestState = taggedEnum({
      Idle: { value: "" },
      Ready: { value: "" },
    });

    type TestStateType = typeof TestState.State;

    let store: ReturnType<typeof createStore<TestStateType>>;
    let context: ReturnType<typeof createContext<TestStateType>>;

    beforeEach(() => {
      store = createStore(TestState.Idle({ value: "initial" }), TestState);
      context = createContext(store);
    });

    describe("provideService", () => {
      it("should add service to context", () => {
        const Database = createServiceTag<TestService>("Database");
        const implementation: TestService = {
          value: "test",
          getValue() {
            return this.value;
          },
        };

        context.provideService(Database, implementation);

        const result = context.getService(Database);
        expect(result.value).toBe("test");
        expect(result.getValue()).toBe("test");
      });

      it("should return context for chaining", () => {
        const Database = createServiceTag<TestService>("Database");
        const Logger = createServiceTag<LoggerService>("Logger");

        const result = context
          .provideService(Database, { value: "db", getValue: () => "db" })
          .provideService(Logger, { info: () => {}, error: () => {} });

        expect(result).toBe(context);
      });
    });

    describe("getService", () => {
      it("should return provided service", () => {
        const Database = createServiceTag<TestService>("Database");
        const impl: TestService = { value: "hello", getValue: () => "hello" };

        context.provideService(Database, impl);
        const result = context.getService(Database);

        expect(result.value).toBe("hello");
      });

      it("should throw when service not provided", () => {
        const Database = createServiceTag<TestService>("Database");

        expect(() => context.getService(Database)).toThrow(
          "Service Database has not been provided"
        );
      });
    });

    describe("getServiceOptional", () => {
      it("should return service when provided", () => {
        const Database = createServiceTag<TestService>("Database");
        const impl: TestService = { value: "test", getValue: () => "test" };

        context.provideService(Database, impl);
        const result = context.getServiceOptional(Database);

        expect(result?.value).toBe("test");
      });

      it("should return undefined when not provided", () => {
        const Database = createServiceTag<TestService>("Database");

        const result = context.getServiceOptional(Database);

        expect(result).toBeUndefined();
      });
    });

    describe("getServiceOptional on disposed context", () => {
      it("should return undefined when context is disposed", () => {
        const Database = createServiceTag<TestService>("Database");

        context.dispose();

        const result = context.getServiceOptional(Database);
        expect(result).toBeUndefined();
      });
    });

    describe("getService on disposed context", () => {
      it("should throw when context is disposed", () => {
        const Database = createServiceTag<TestService>("Database");

        context.dispose();

        expect(() => context.getService(Database)).toThrow(
          "Cannot get service from disposed context"
        );
      });
    });
  });

  describe("Service-aware actions", () => {
    const TestState = taggedEnum({
      Idle: { data: null as string | null },
      Ready: { data: null as string | null },
    });

    type TestStateType = typeof TestState.State;

    it("should provide context to sync action withHandler", () => {
      const Logger = createServiceTag<{
        info: (msg: string) => void;
        error: (msg: string) => void;
      }>("Logger");

      const processAction = createAction<{ value: string }, TestStateType>("Process").withHandler(
        (state, payload, ctx) => {
          const logger = ctx.getService(Logger);
          logger.info(`Processing ${payload.value}`);
          return { ...state, data: payload.value };
        }
      );

      const store = createStore(TestState.Idle({ data: null }), TestState);
      const context = createContext(store);

      const mockLogger = {
        info: vi.fn(),
        error: vi.fn(),
      };

      context.provideService(Logger, mockLogger);

      store.register("Process", processAction);

      context.dispatch(processAction, { value: "test-data" });

      expect(mockLogger.info).toHaveBeenCalledWith("Processing test-data");
      expect(store.stateValue._tag).toBe("Idle");
      expect((store.stateValue as any).data).toBe("test-data");
    });

    it("should access multiple services in handler", () => {
      const Database = createServiceTag<{ query: () => string }>("Database");
      const Logger = createServiceTag<{ info: (msg: string) => void }>("Logger");

      const queryAction = createAction<{ key: string }, TestStateType>("Query").withHandler(
        (state, payload, ctx) => {
          const db = ctx.getService(Database);
          const logger = ctx.getService(Logger);

          const result = db.query();
          logger.info(`Query result: ${result}`);

          return { ...state, data: result };
        }
      );

      const store = createStore(TestState.Idle({ data: null }), TestState);
      const context = createContext(store);

      context.provideService(Database, {
        query: () => "database-result",
      });

      context.provideService(Logger, {
        info: vi.fn(),
        error: vi.fn(),
      } as LoggerService);

      store.register("Query", queryAction);

      context.dispatch(queryAction, { key: "test" });

      expect((store.stateValue as any).data).toBe("database-result");
    });

    it("should use optional service when available", () => {
      const Cache = createServiceTag<{ get: (key: string) => string | undefined }>("Cache");

      const cacheAction = createAction<{ key: string }, TestStateType>("GetFromCache").withHandler(
        (state, payload, ctx) => {
          const cache = ctx.getServiceOptional(Cache);

          if (cache) {
            const cached = cache.get(payload.key);
            if (cached) {
              return { ...state, data: cached };
            }
          }

          return { ...state, data: "not-found" };
        }
      );

      const store = createStore(TestState.Idle({ data: null }), TestState);
      const context = createContext(store);

      context.provideService(Cache, {
        get: (key) => (key === "cached-key" ? "cached-value" : undefined),
      });

      store.register("GetFromCache", cacheAction);

      context.dispatch(cacheAction, { key: "cached-key" });
      expect((store.stateValue as any).data).toBe("cached-value");

      context.dispatch(cacheAction, { key: "other-key" });
      expect((store.stateValue as any).data).toBe("not-found");
    });
  });

  describe("Real-world scenarios", () => {
    describe("HTTP API Service", () => {
      const ApiState = taggedEnum({
        Idle: {},
        Loading: {},
        Success: { data: null as unknown },
        Error: { message: "" },
      });

      type ApiStateType = typeof ApiState.State;

      interface HttpService {
        get<T>(url: string): T;
        post<T, B>(url: string, body: B): T;
      }

      interface LoggerService {
        info(message: string): void;
        warn(message: string): void;
        error(message: string): void;
      }

      it("should use HTTP service in action handler", () => {
        const Http = createServiceTag<HttpService>("Http");
        const Logger = createServiceTag<LoggerService>("Logger");

        const fetchData = createAction<{ userId: number }, ApiStateType>("FetchData").withHandler(
          (state, payload, ctx) => {
            const http = ctx.getService(Http);
            const logger = ctx.getService(Logger);

            logger.info(`Fetching data for user ${payload.userId}`);

            const result = http.get<Array<{ id: number; title: string }>>(
              `https://jsonplaceholder.typicode.com/users/${payload.userId}/posts`
            );

            return { ...state, data: result, _tag: "Success" };
          }
        );

        const store = createStore(ApiState.Idle({}), ApiState);
        const context = createContext(store);

        const mockHttp: HttpService = {
          get<T>(_url: string): T {
            return [{ id: 1, title: "Test Post" }] as T;
          },
          post<T, B>(_url: string, _body: B): T {
            return {} as T;
          },
        };

        const mockLogger: LoggerService = {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        };

        context.provideService(Http, mockHttp);
        context.provideService(Logger, mockLogger);

        store.register("FetchData", fetchData);

        context.dispatch(fetchData, { userId: 1 });

        expect(mockLogger.info).toHaveBeenCalledWith("Fetching data for user 1");
        expect(store.stateValue._tag).toBe("Success");
        expect((store.stateValue as any).data).toHaveLength(1);
      });

      it("should handle service errors in handler", () => {
        const Http = createServiceTag<HttpService>("Http");
        const Logger = createServiceTag<LoggerService>("Logger");

        const fetchData = createAction<{ url: string }, ApiStateType>("FetchData").withHandler(
          (state, payload, ctx) => {
            const http = ctx.getService(Http);
            const logger = ctx.getService(Logger);

            try {
              const data = http.get<{ result: string }>(payload.url);
              return { ...state, data, _tag: "Success" };
            } catch (error) {
              logger.error(`Error: ${error}`);
              return { ...state, message: String(error), _tag: "Error" };
            }
          }
        );

        const store = createStore(ApiState.Idle({}), ApiState);
        const context = createContext(store);

        const mockHttp: HttpService = {
          get<T>(_url: string): T {
            throw new Error("Network error");
          },
          post<T, B>(_url: string, _body: B): T {
            throw new Error("Not implemented");
          },
        };

        const mockLogger: LoggerService = {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        };

        context.provideService(Http, mockHttp);
        context.provideService(Logger, mockLogger);

        store.register("FetchData", fetchData);

        context.dispatch(fetchData, { url: "https://api.example.com/data" });

        expect(mockLogger.error).toHaveBeenCalled();
        expect(store.stateValue._tag).toBe("Error");
      });
    });

    describe("Cache Service with fallback", () => {
      const DataState = taggedEnum({
        Empty: {},
        Loaded: { data: "" },
      });

      type DataStateType = typeof DataState.State;

      interface CacheService {
        get(key: string): string | undefined;
        set(key: string, value: string, ttl?: number): void;
        delete(key: string): void;
      }

      interface ApiService {
        fetchData(id: string): string;
      }

      it("should use cache when available and fallback to API", () => {
        const Cache = createServiceTag<CacheService>("Cache");
        const Api = createServiceTag<ApiService>("Api");

        const loadData = createAction<{ id: string }, DataStateType>("LoadData").withHandler(
          (state, payload, ctx) => {
            const cache = ctx.getServiceOptional(Cache);
            const api = ctx.getService(Api);

            if (cache) {
              const cached = cache.get(`data:${payload.id}`);
              if (cached) {
                return { ...state, data: cached, _tag: "Loaded" };
              }
            }

            const data = api.fetchData(payload.id);

            if (cache) {
              cache.set(`data:${payload.id}`, data, 300);
            }

            return { ...state, data, _tag: "Loaded" };
          }
        );

        const store = createStore(DataState.Empty({}), DataState);
        const context = createContext(store);

        const mockCache: CacheService = {
          get(key: string): string | undefined {
            if (key === "data:123") {
              return "cached-value";
            }
            return undefined;
          },
          set(_key: string, _value: string, _ttl?: number): void {},
          delete(_key: string): void {},
        };

        const mockApi: ApiService = {
          fetchData(_id: string): string {
            return "api-value";
          },
        };

        context.provideService(Cache, mockCache);
        context.provideService(Api, mockApi);

        store.register("LoadData", loadData);

        context.dispatch(loadData, { id: "123" });
        expect((store.stateValue as any).data).toBe("cached-value");

        context.dispatch(loadData, { id: "456" });
        expect((store.stateValue as any).data).toBe("api-value");
      });
    });

    describe("Authentication service composition", () => {
      const AppState = taggedEnum({
        Unauthenticated: {},
        Authenticated: { user: null as { id: string; name: string; email: string } | null },
        Error: { message: "" },
      });

      type AppStateType = typeof AppState.State;

      interface AuthService {
        login(username: string, password: string): { id: string; name: string; email: string };
        logout(): void;
      }

      interface LoggerService {
        info(message: string): void;
        error(message: string): void;
      }

      interface AnalyticsService {
        track(event: string, data: Record<string, unknown>): void;
      }

      it("should compose multiple services for authentication", () => {
        const Auth = createServiceTag<AuthService>("Auth");
        const Logger = createServiceTag<LoggerService>("Logger");
        const Analytics = createServiceTag<AnalyticsService>("Analytics");

        const loginAction = createAction<{ username: string; password: string }, AppStateType>(
          "Login"
        ).withHandler((state, payload, ctx) => {
          const auth = ctx.getService(Auth);
          const logger = ctx.getService(Logger);
          const analytics = ctx.getServiceOptional(Analytics);

          logger.info(`Attempting login for ${payload.username}`);

          try {
            if (payload.username === "valid" && payload.password === "password") {
              const user = auth.login(payload.username, payload.password);
              analytics?.track("user_login", { userId: user.id });
              return { ...state, user, _tag: "Authenticated" };
            } else {
              analytics?.track("login_failed", { username: payload.username });
              return { ...state, message: "Invalid credentials", _tag: "Error" };
            }
          } catch (error) {
            logger.error(`Login failed: ${error}`);
            return { ...state, message: String(error), _tag: "Error" };
          }
        });

        const store = createStore(AppState.Unauthenticated({}), AppState);
        const context = createContext(store);

        const mockAuth: AuthService = {
          login(username, password) {
            if (username === "valid" && password === "password") {
              return { id: "123", name: "Test User", email: "test@example.com" };
            }
            throw new Error("Invalid credentials");
          },
          logout() {},
        };

        const mockLogger: LoggerService = {
          info: vi.fn(),
          error: vi.fn(),
        };

        const mockAnalytics: AnalyticsService = {
          track: vi.fn(),
        };

        context.provideService(Auth, mockAuth);
        context.provideService(Logger, mockLogger);
        context.provideService(Analytics, mockAnalytics);

        store.register("Login", loginAction);

        context.dispatch(loginAction, { username: "valid", password: "password" });

        expect(store.stateValue._tag).toBe("Authenticated");
        expect((store.stateValue as any).user?.name).toBe("Test User");
        expect(mockAnalytics.track).toHaveBeenCalledWith("user_login", { userId: "123" });

        context.dispatch(loginAction, { username: "invalid", password: "wrong" });

        expect(store.stateValue._tag).toBe("Error");
        expect(mockAnalytics.track).toHaveBeenCalledWith("login_failed", { username: "invalid" });
      });

      it("should work without optional analytics service", () => {
        const Auth = createServiceTag<AuthService>("Auth");
        const Logger = createServiceTag<LoggerService>("Logger");
        const Analytics = createServiceTag<AnalyticsService>("Analytics");

        const loginAction = createAction<{ username: string; password: string }, AppStateType>(
          "Login"
        ).withHandler((state, payload, ctx) => {
          const auth = ctx.getService(Auth);
          const logger = ctx.getService(Logger);
          const analytics = ctx.getServiceOptional(Analytics);

          logger.info(`Login attempt for ${payload.username}`);

          const user = auth.login(payload.username, payload.password);
          analytics?.track("login", { userId: user.id });

          return { ...state, user, _tag: "Authenticated" };
        });

        const store = createStore(AppState.Unauthenticated({}), AppState);
        const context = createContext(store);

        const mockAuth: AuthService = {
          login() {
            return { id: "123", name: "Test", email: "test@test.com" };
          },
          logout() {},
        };

        const mockLogger: LoggerService = {
          info: vi.fn(),
          error: vi.fn(),
        };

        context.provideService(Auth, mockAuth);
        context.provideService(Logger, mockLogger);

        store.register("Login", loginAction);

        context.dispatch(loginAction, { username: "valid", password: "password" });

        expect(store.stateValue._tag).toBe("Authenticated");
      });
    });

    describe("Service registry pattern", () => {
      it("should use service registry for organized services", () => {
        const Database = createServiceTag<{ query: () => string }>("Database");
        const Cache = createServiceTag<{ get: () => string }>("Cache");
        const Logger = createServiceTag<{ log: () => void }>("Logger");

        const registry = createServiceRegistry({
          database: Database,
          cache: Cache,
          logger: Logger,
        });

        expect(registry.database).toBe(Database);
        expect(registry.cache).toBe(Cache);
        expect(registry.logger).toBe(Logger);
      });
    });
  });

  describe("HTTP API Service with async", () => {
    const ApiState = taggedEnum({
      Idle: {},
      Loading: {},
      Success: { data: null as unknown },
      Error: { message: "" },
    });

    type ApiStateType = typeof ApiState.State;

    interface HttpService {
      get<T>(url: string): T;
      post<T, B>(url: string, body: B): T;
      put<T, B>(url: string, body: B): T;
      delete(url: string): void;
    }

    interface LoggerService {
      info(message: string): void;
      warn(message: string): void;
      error(message: string): void;
    }

    it("should fetch from public API using service", () => {
      const Http = createServiceTag<HttpService>("Http");
      const Logger = createServiceTag<LoggerService>("Logger");

      const fetchUsers = createAction<{ userId: number }, ApiStateType>("FetchUsers").withHandler(
        (state, payload, ctx) => {
          const http = ctx.getService(Http);
          const logger = ctx.getService(Logger);

          logger.info(`Fetching users from API for user ${payload.userId}`);

          try {
            const response = http.get<Array<{ id: number; title: string }>>(
              `https://jsonplaceholder.typicode.com/users/${payload.userId}/posts`
            );
            return { ...state, data: response, _tag: "Success" };
          } catch (error) {
            logger.error(`Failed to fetch users: ${error}`);
            return { ...state, message: String(error), _tag: "Error" };
          }
        }
      );

      const store = createStore(ApiState.Idle({}), ApiState);
      const context = createContext(store);

      const mockHttp: HttpService = {
        get<T>(_url: string): T {
          return [{ id: 1, title: "Test Post" }] as T;
        },
        post<T, B>(_url: string, _body: B): T {
          return {} as T;
        },
        put<T, B>(_url: string, _body: B): T {
          return {} as T;
        },
        delete(_url: string): void {},
      };

      const mockLogger: LoggerService = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      context.provideService(Http, mockHttp);
      context.provideService(Logger, mockLogger);

      store.register("FetchUsers", fetchUsers);

      context.dispatch(fetchUsers, { userId: 1 });

      expect(mockLogger.info).toHaveBeenCalledWith("Fetching users from API for user 1");
      expect(store.stateValue._tag).toBe("Success");
      expect((store.stateValue as any).data).toHaveLength(1);
    });

    it("should handle API errors gracefully", () => {
      const Http = createServiceTag<HttpService>("Http");
      const Logger = createServiceTag<LoggerService>("Logger");

      const fetchData = createAction<{ url: string }, ApiStateType>("FetchData").withHandler(
        (state, payload, ctx) => {
          const http = ctx.getService(Http);
          const logger = ctx.getService(Logger);

          try {
            const data = http.get<{ result: string }>(payload.url);
            return { ...state, data, _tag: "Success" };
          } catch (error) {
            logger.error(`API error: ${error}`);
            return { ...state, message: String(error), _tag: "Error" };
          }
        }
      );

      const store = createStore(ApiState.Idle({}), ApiState);
      const context = createContext(store);

      const mockHttp: HttpService = {
        get<T>(_url: string): T {
          throw new Error("Network error");
        },
        post<T, B>(_url: string, _body: B): T {
          throw new Error("Not implemented");
        },
        put<T, B>(_url: string, _body: B): T {
          throw new Error("Not implemented");
        },
        delete(_url: string): void {
          throw new Error("Not implemented");
        },
      };

      const mockLogger: LoggerService = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      context.provideService(Http, mockHttp);
      context.provideService(Logger, mockLogger);

      store.register("FetchData", fetchData);

      context.dispatch(fetchData, { url: "https://api.example.com/data" });

      expect(mockLogger.error).toHaveBeenCalled();
      expect(store.stateValue._tag).toBe("Error");
    });
  });

  describe("Cache Service with API fallback", () => {
    const DataState = taggedEnum({
      Empty: {},
      Loading: {},
      Loaded: { data: "" },
      Error: { message: "" },
    });

    type DataStateType = typeof DataState.State;

    interface CacheService {
      get<T>(key: string): T | null;
      set<T>(key: string, value: T, ttl?: number): void;
      delete(key: string): void;
    }

    interface ApiService {
      fetchData<T>(id: string): T;
    }

    it("should use cache when available and fallback to API", () => {
      const Cache = createServiceTag<CacheService>("Cache");
      const Api = createServiceTag<ApiService>("Api");

      const loadData = createAction<{ id: string }, DataStateType>("LoadData").withHandler(
        (state, payload, ctx) => {
          const cache = ctx.getServiceOptional(Cache);
          const api = ctx.getService(Api);

          if (cache) {
            const cached = cache.get<string>(`data:${payload.id}`);
            if (cached) {
              return { ...state, data: cached, _tag: "Loaded" };
            }
          }

          const data = api.fetchData<string>(payload.id);

          if (cache) {
            cache.set(`data:${payload.id}`, data, 300);
          }

          return { ...state, data, _tag: "Loaded" };
        }
      );

      const store = createStore(DataState.Empty({}), DataState);
      const context = createContext(store);

      const mockCache: CacheService = {
        get<T>(key: string): T | null {
          if (key === "data:123") {
            return "cached-value" as T;
          }
          return null;
        },
        set<T>(_key: string, _value: T, _ttl?: number): void {},
        delete(_key: string): void {},
      };

      const mockApi: ApiService = {
        fetchData<T>(_id: string): T {
          return "api-value" as T;
        },
      };

      context.provideService(Cache, mockCache);
      context.provideService(Api, mockApi);

      store.register("LoadData", loadData);

      context.dispatch(loadData, { id: "123" });

      expect((store.stateValue as any).data).toBe("cached-value");

      context.dispatch(loadData, { id: "456" });

      expect((store.stateValue as any).data).toBe("api-value");
    });
  });

  describe("Service composition", () => {
    const AppState = taggedEnum({
      Unauthenticated: {},
      Authenticated: { user: null as { id: string; name: string; email: string } | null },
      Error: { message: "" },
    });

    type AppStateType = typeof AppState.State;

    interface AuthService {
      login(username: string, password: string): { id: string; name: string; email: string };
      logout(): void;
      getCurrentUser(): { id: string; name: string; email: string } | null;
    }

    interface LoggerService {
      info(message: string): void;
      error(message: string): void;
    }

    interface AnalyticsService {
      track(event: string, data: Record<string, unknown>): void;
    }

    it("should compose multiple services for authentication flow", () => {
      const Auth = createServiceTag<AuthService>("Auth");
      const Logger = createServiceTag<LoggerService>("Logger");
      const Analytics = createServiceTag<AnalyticsService>("Analytics");

      const loginAction = createAction<{ username: string; password: string }, AppStateType>(
        "Login"
      ).withHandler((state, payload, ctx) => {
        const auth = ctx.getService(Auth);
        const logger = ctx.getService(Logger);
        const analytics = ctx.getServiceOptional(Analytics);

        logger.info(`Attempting login for ${payload.username}`);

        try {
          const user = auth.login(payload.username, payload.password);

          analytics?.track("user_login", { userId: user.id });

          return { ...state, user, _tag: "Authenticated" };
        } catch (error) {
          logger.error(`Login failed: ${error}`);
          analytics?.track("login_failed", { username: payload.username });
          return { ...state, message: String(error), _tag: "Error" };
        }
      });

      const store = createStore(AppState.Unauthenticated({}), AppState);
      const context = createContext(store);

      const mockAuth: AuthService = {
        login(username, password) {
          if (username === "valid" && password === "password") {
            return { id: "123", name: "Test User", email: "test@example.com" };
          }
          throw new Error("Invalid credentials");
        },
        logout() {},
        getCurrentUser() {
          return null;
        },
      };

      const mockLogger: LoggerService = {
        info: vi.fn(),
        error: vi.fn(),
      };

      const mockAnalytics: AnalyticsService = {
        track: vi.fn(),
      };

      context.provideService(Auth, mockAuth);
      context.provideService(Logger, mockLogger);
      context.provideService(Analytics, mockAnalytics);

      store.register("Login", loginAction);

      context.dispatch(loginAction, { username: "valid", password: "password" });

      expect(store.stateValue._tag).toBe("Authenticated");
      expect((store.stateValue as any).user?.name).toBe("Test User");
      expect(mockAnalytics.track).toHaveBeenCalledWith("user_login", { userId: "123" });

      context.dispatch(loginAction, { username: "invalid", password: "wrong" });

      expect(store.stateValue._tag).toBe("Error");
      expect(mockAnalytics.track).toHaveBeenCalledWith("login_failed", { username: "invalid" });
    });
  });

  describe("Service registry pattern", () => {
    it("should use service registry for organized services", () => {
      const Database = createServiceTag<{ query: () => string }>("Database");
      const Cache = createServiceTag<{ get: () => string }>("Cache");
      const Logger = createServiceTag<{ log: () => void }>("Logger");

      const registry = createServiceRegistry({
        database: Database,
        cache: Cache,
        logger: Logger,
      });

      expect(registry.database).toBe(Database);
      expect(registry.cache).toBe(Cache);
      expect(registry.logger).toBe(Logger);
    });
  });
});
