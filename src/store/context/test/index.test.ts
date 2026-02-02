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

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createStore, createAction, createContext, taggedEnum } from "../../index";
import { isSome, isNone, unwrap } from "../../../lib/Data/option";
import { getValue } from "../../test/utils";

const CounterState = taggedEnum({
  Idle: { value: 0 },
  Loading: {},
  Ready: { value: 0 },
  Error: { message: "", code: 0 },
});

type CounterStateType = typeof CounterState.State;

describe("TagixContext", () => {
  describe("createContext", () => {
    it("should create a context from a store", () => {
      const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
        name: "TestCounter",
      });
      const context = createContext(store);

      expect(context.storeName).toBe("TestCounter");
      expect(context.id).toBeDefined();
    });

    it("should return the current state", () => {
      const store = createStore(CounterState.Idle({ value: 42 }), CounterState);
      const context = createContext(store);

      expect(context.getCurrent()._tag).toBe("Idle");
      expect(getValue(context.getCurrent())).toBe(42);
    });

    it("should support nested contexts", () => {
      const store = createStore(CounterState.Idle({ value: 0 }), CounterState);
      const context = createContext(store);
      const subContext = context.provide("nested", { deep: true });

      expect(subContext.storeName).toContain("nested");
    });
  });

  describe("select", () => {
    it("should select and subscribe to state changes", () => {
      const store = createStore(CounterState.Idle({ value: 0 }), CounterState);
      const context = createContext(store);

      const increment = createAction<{ amount: number }, CounterStateType>("Increment")
        .withPayload({ amount: 1 })
        .withState((s, p) => {
          const state = s as Extract<CounterStateType, { value: number }>;
          return { ...s, value: state.value + p.amount } as CounterStateType;
        });

      store.register("Increment", increment);

      let selectedValue = -1;
      const unsubscribe = context.select(
        (state) => getValue(state),
        (value) => {
          selectedValue = value;
        }
      );

      expect(selectedValue).toBe(0);

      store.dispatch("tagix/action/Increment", { amount: 5 });
      expect(selectedValue).toBe(5);

      store.dispatch("tagix/action/Increment", { amount: 3 });
      expect(selectedValue).toBe(8);

      unsubscribe();

      store.dispatch("tagix/action/Increment", { amount: 10 });
      expect(selectedValue).toBe(8);
    });

    it("should support selecting nested properties", () => {
      const store = createStore(CounterState.Ready({ value: 100 }), CounterState);
      const context = createContext(store);

      let tag = "";
      context.subscribeKey("_tag", (t) => {
        tag = t;
      });

      expect(tag).toBe("Ready");
    });
  });

  describe("subscribeKey", () => {
    it("should subscribe to specific state property changes", () => {
      const store = createStore(CounterState.Idle({ value: 0 }), CounterState);
      const context = createContext(store);

      const increment = createAction<{ amount: number }, CounterStateType>("Increment")
        .withPayload({ amount: 1 })
        .withState((s, p) => {
          const state = s as Extract<CounterStateType, { value: number }>;
          return { ...s, value: state.value + p.amount } as CounterStateType;
        });

      store.register("Increment", increment);

      let lastValue = -1;
      context.subscribeKey("value" as never, (val) => {
        lastValue = val as number;
      });

      expect(lastValue).toBe(0);

      context.dispatch("tagix/action/Increment", { amount: 5 });
      expect(lastValue).toBe(5);

      context.dispatch("tagix/action/Increment", { amount: 3 });
      expect(lastValue).toBe(8);
    });

    it("should return unsubscribe function", () => {
      const store = createStore(CounterState.Idle({ value: 0 }), CounterState);
      const context = createContext(store);

      let callCount = 0;
      const unsubscribe = context.subscribeKey("_tag", () => {
        callCount++;
      });

      // subscribeKey calls select which calls store.subscribe
      // store.subscribe now calls callback immediately
      expect(callCount).toBe(1);

      const increment = createAction<{ amount: number }, CounterStateType>("Increment")
        .withPayload({ amount: 1 })
        .withState((s, p) => {
          const state = s as Extract<CounterStateType, { value: number }>;
          return { ...s, value: state.value + p.amount } as CounterStateType;
        });

      store.register("Increment", increment);

      context.dispatch("tagix/action/Increment", { amount: 1 });
      expect(callCount).toBe(2);

      unsubscribe();

      context.dispatch("tagix/action/Increment", { amount: 1 });
      expect(callCount).toBe(2);
    });
  });

  describe("getState", () => {
    it("should return current state as alias for getCurrent", () => {
      const store = createStore(CounterState.Idle({ value: 123 }), CounterState);
      const context = createContext(store);

      const state1 = context.getCurrent();
      const state2 = context.getState();

      expect(state1).toEqual(state2);
      expect(state1._tag).toBe("Idle");
      expect(getValue(state2)).toBe(123);
    });
  });

  describe("selectAsync", () => {
    it("should return a promise that resolves with selected value", async () => {
      const store = createStore(CounterState.Idle({ value: 50 }), CounterState);
      const context = createContext(store);

      const { promise, unsubscribe } = context.selectAsync((state) => getValue(state));

      const value = await promise;
      expect(value).toBe(50);

      unsubscribe();
    });
  });

  describe("dispatch", () => {
    it("should dispatch actions through the store", () => {
      const store = createStore(CounterState.Idle({ value: 0 }), CounterState);
      const context = createContext(store);

      const increment = createAction<{ amount: number }, CounterStateType>("Increment")
        .withPayload({ amount: 1 })
        .withState((s, p) => {
          const state = s as Extract<CounterStateType, { value: number }>;
          return { ...s, value: state.value + p.amount } as CounterStateType;
        });

      store.register("Increment", increment);

      context.dispatch("tagix/action/Increment", { amount: 10 });

      expect(getValue(context.getCurrent())).toBe(10);
    });
  });

  describe("fork/clone", () => {
    it("should support forking context", () => {
      const store = createStore(CounterState.Idle({ value: 0 }), CounterState);
      const context = createContext(store);

      const increment = createAction<{ amount: number }, CounterStateType>("Increment")
        .withPayload({ amount: 1 })
        .withState((s, p) => {
          const state = s as Extract<CounterStateType, { value: number }>;
          return { ...s, value: state.value + p.amount } as CounterStateType;
        });

      store.register("Increment", increment);

      context.dispatch("tagix/action/Increment", { amount: 10 });

      const fork = context.fork();

      fork.dispatch("tagix/action/Increment", { amount: 100 });

      expect(getValue(context.getCurrent())).toBe(110);
      expect(getValue(fork.getCurrent())).toBe(110);
    });

    it("should support cloning context", () => {
      const store = createStore(CounterState.Idle({ value: 42 }), CounterState);
      const context = createContext(store);

      const clone = context.clone();

      expect(clone.getCurrent()).toEqual(context.getCurrent());
      expect(clone).not.toBe(context);
    });
  });

  describe("merge", () => {
    it("should support merging forked contexts", () => {
      const store = createStore(CounterState.Idle({ value: 0 }), CounterState);
      const context = createContext(store);

      const increment = createAction<{ amount: number }, CounterStateType>("Increment")
        .withPayload({ amount: 1 })
        .withState((s, p) => {
          const state = s as Extract<CounterStateType, { value: number }>;
          return { ...s, value: state.value + p.amount } as CounterStateType;
        });

      store.register("Increment", increment);

      context.dispatch("tagix/action/Increment", { amount: 10 });

      const fork = context.fork();
      fork.dispatch("tagix/action/Increment", { amount: 5 });

      context.merge(fork);

      expect(getValue(context.getCurrent())).toBe(15);
    });
  });

  describe("subscribe", () => {
    it("should support direct subscriptions", () => {
      const store = createStore(CounterState.Idle({ value: 0 }), CounterState);
      const context = createContext(store);

      const increment = createAction<{ amount: number }, CounterStateType>("Increment")
        .withPayload({ amount: 1 })
        .withState((s, p) => {
          const state = s as Extract<CounterStateType, { value: number }>;
          return { ...s, value: state.value + p.amount } as CounterStateType;
        });

      store.register("Increment", increment);

      let callCount = 0;
      const unsubscribe = context.subscribe(() => {
        callCount++;
      });

      expect(callCount).toBe(1);

      context.dispatch("tagix/action/Increment", { amount: 5 });
      expect(callCount).toBe(2);

      context.dispatch("tagix/action/Increment", { amount: 3 });
      expect(callCount).toBe(3);

      unsubscribe();

      context.dispatch("tagix/action/Increment", { amount: 1 });
      expect(callCount).toBe(3);
    });
  });

  describe("dispose", () => {
    it("should cleanup subscriptions on dispose", () => {
      const store = createStore(CounterState.Idle({ value: 0 }), CounterState);
      const context = createContext(store);

      let value = -1;
      context.select(
        (state) => getValue(state),
        (v) => {
          value = v;
        }
      );

      expect(value).toBe(0);

      context.dispose();

      const increment = createAction<{ amount: number }, CounterStateType>("Increment")
        .withPayload({ amount: 1 })
        .withState((s, p) => {
          const state = s as Extract<CounterStateType, { value: number }>;
          return { ...s, value: state.value + p.amount } as CounterStateType;
        });

      store.register("Increment", increment);
      store.dispatch("tagix/action/Increment", { amount: 100 });

      expect(value).toBe(0);
    });

    it("should throw after dispose", () => {
      const store = createStore(CounterState.Idle({ value: 0 }), CounterState);
      const context = createContext(store);

      context.dispose();

      expect(() => context.getCurrent()).toThrow("disposed");
      expect(() => context.dispatch("test", {})).toThrow("disposed");
      expect(() => context.provide("key", {})).toThrow("disposed");
    });
  });

  describe("provide", () => {
    it("should provide values to sub-contexts", () => {
      const store = createStore(CounterState.Idle({ value: 0 }), CounterState);
      const context = createContext(store);

      const subContext = context.provide("user", { name: "John", age: 30 });

      const user = subContext.get<{ name: string; age: number }>("user");
      expect(isSome(user)).toBe(true);
      expect(unwrap(user)).toEqual({ name: "John", age: 30 });
    });

    it("should support derived values in provide", () => {
      const store = createStore(CounterState.Idle({ value: 10 }), CounterState);
      const context = createContext(store);

      const subContext = context.provide("derived", (parent) => ({
        doubled: getValue(parent) * 2,
      }));

      const derived = subContext.get<{ doubled: number }>("derived");
      expect(isSome(derived)).toBe(true);
      expect(unwrap(derived).doubled).toBe(20);
    });
  });

  describe("use hook pattern", () => {
    it("should support use() without selector", () => {
      const store = createStore(CounterState.Idle({ value: 99 }), CounterState);
      const context = createContext(store);

      const state = context.use();
      expect(getValue(state)).toBe(99);
    });

    it("should support use() with selector", () => {
      const store = createStore(CounterState.Ready({ value: 777 }), CounterState);
      const context = createContext(store);

      const value = context.use<number>((state) => getValue(state));
      expect(value).toBe(777);
    });
  });

  describe("get", () => {
    it("should return None for non-existent keys", () => {
      const store = createStore(CounterState.Idle({ value: 0 }), CounterState);
      const context = createContext(store);

      const result = context.get<number>("nonexistent");
      expect(isNone(result)).toBe(true);
    });

    it("should return Some for provided values", () => {
      const store = createStore(CounterState.Idle({ value: 0 }), CounterState);
      const context = createContext(store);
      const subContext = context.provide("theme", "dark");

      const theme = subContext.get<string>("theme");
      expect(isSome(theme)).toBe(true);
      expect(unwrap(theme)).toBe("dark");
    });
  });

  describe("Symbol.dispose", () => {
    it("should support using Symbol.dispose", () => {
      const store = createStore(CounterState.Idle({ value: 0 }), CounterState);
      const context = createContext(store);

      {
        using _ = context as unknown as { [Symbol.dispose]: () => void } & typeof context;
        _.dispose();
      }

      expect(context.isDisposed).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle rapid state changes", () => {
      const store = createStore(CounterState.Idle({ value: 0 }), CounterState);
      const context = createContext(store);

      const increment = createAction<{ amount: number }, CounterStateType>("Increment")
        .withPayload({ amount: 1 })
        .withState((s, p) => {
          const state = s as Extract<CounterStateType, { value: number }>;
          return { ...s, value: state.value + p.amount } as CounterStateType;
        });

      store.register("Increment", increment);

      let lastValue = 0;
      context.subscribe((state) => {
        lastValue = getValue(state);
      });

      for (let i = 0; i < 100; i++) {
        context.dispatch("tagix/action/Increment", { amount: 1 });
      }

      expect(lastValue).toBe(100);
    });

    it("should handle multiple subscribers", () => {
      const store = createStore(CounterState.Idle({ value: 0 }), CounterState);
      const context = createContext(store);

      const increment = createAction<{ amount: number }, CounterStateType>("Increment")
        .withPayload({ amount: 1 })
        .withState((s, p) => {
          const state = s as Extract<CounterStateType, { value: number }>;
          return { ...s, value: state.value + p.amount } as CounterStateType;
        });

      store.register("Increment", increment);

      let call1 = 0;
      let call2 = 0;
      let call3 = 0;

      context.subscribe(() => call1++);
      context.subscribe(() => call2++);
      context.select(
        () => 0,
        () => call3++
      );

      context.dispatch("tagix/action/Increment", { amount: 1 });

      expect(call1).toBe(2); // Initial + dispatch
      expect(call2).toBe(2); // Initial + dispatch
      expect(call3).toBe(2); // Initial + dispatch (select uses internal notification)
    });
  });

  describe("error handling", () => {
    it("should track errors through context", () => {
      const store = createStore(CounterState.Idle({ value: 0 }), CounterState);
      const context = createContext(store);

      const failingAction = createAction<Record<string, never>, CounterStateType>("Fail")
        .withPayload({})
        .withState(() => {
          throw new Error("Test error");
        });

      store.register("Fail", failingAction);

      expect(() => {
        context.dispatch("tagix/action/Fail", {});
      }).toThrow("Test error");

      expect(store.lastError).toBeInstanceOf(Error);
      expect((store.lastError as Error).message).toBe("Test error");
    });

    it("should cleanup forked contexts on dispose", () => {
      const store = createStore(CounterState.Idle({ value: 0 }), CounterState);
      const context = createContext(store);

      const fork1 = context.fork();
      const fork2 = context.fork();

      expect(fork1.isDisposed).toBe(false);
      expect(fork2.isDisposed).toBe(false);

      context.dispose();

      expect(fork1.isDisposed).toBe(true);
      expect(fork2.isDisposed).toBe(true);
    });

    it("should allow independent fork disposal", () => {
      const store = createStore(CounterState.Idle({ value: 0 }), CounterState);
      const context = createContext(store);

      const fork1 = context.fork();
      const fork2 = context.fork();

      fork1.dispose();

      expect(fork1.isDisposed).toBe(true);
      expect(fork2.isDisposed).toBe(false);

      fork2.dispose();

      expect(fork2.isDisposed).toBe(true);
    });

    it("should cleanup derived sub-contexts on dispose", () => {
      const store = createStore(CounterState.Idle({ value: 0 }), CounterState);
      const context = createContext(store);

      const sub1 = context.provide("sub1", { data: 1 });
      const sub2 = sub1.provide("sub2", { data: 2 });
      const sub3 = sub2.provide("sub3", { data: 3 });

      expect(sub1.isDisposed).toBe(false);
      expect(sub2.isDisposed).toBe(false);
      expect(sub3.isDisposed).toBe(false);

      context.dispose();

      expect(sub1.isDisposed).toBe(true);
      expect(sub2.isDisposed).toBe(true);
      expect(sub3.isDisposed).toBe(true);
    });

    it("should handle nested provide chains", () => {
      const store = createStore(CounterState.Idle({ value: 10 }), CounterState);
      const context = createContext(store);

      const level1 = context.provide("level", { level: 1 });
      const level2 = level1.provide("level", { level: 2 });
      const level3 = level2.provide("level", { level: 3 });

      const v1 = level1.get<{ level: number }>("level");
      const v2 = level2.get<{ level: number }>("level");
      const v3 = level3.get<{ level: number }>("level");

      expect(isSome(v1)).toBe(true);
      expect(unwrap(v1).level).toBe(1);

      expect(isSome(v2)).toBe(true);
      expect(unwrap(v2).level).toBe(2);

      expect(isSome(v3)).toBe(true);
      expect(unwrap(v3).level).toBe(3);
    });

    it("should handle derived values from parent state", () => {
      const store = createStore(CounterState.Idle({ value: 5 }), CounterState);
      const context = createContext(store);

      const derivedContext = context.provide("derived", (parent) => ({
        value: getValue(parent),
        doubled: getValue(parent) * 2,
        tripled: getValue(parent) * 3,
      }));

      const derived = derivedContext.get<{ value: number; doubled: number; tripled: number }>(
        "derived"
      );
      expect(isSome(derived)).toBe(true);
      expect(unwrap(derived)).toEqual({ value: 5, doubled: 10, tripled: 15 });
    });
  });

  describe("complete example", () => {
    it("should work with all features combined", async () => {
      const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
        name: "Counter",
      });
      const context = createContext(store);

      const increment = createAction<{ amount: number }, CounterStateType>("Increment")
        .withPayload({ amount: 1 })
        .withState((s, p) => {
          const state = s as Extract<CounterStateType, { value: number }>;
          return { ...s, value: state.value + p.amount } as CounterStateType;
        });

      store.register("Increment", increment);

      let stateChanges = 0;
      let selectedValue = 0;
      context.subscribe(() => {
        stateChanges++;
      });
      context.select(
        (state) => getValue(state),
        (value) => {
          selectedValue = value;
        }
      );

      expect(stateChanges).toBe(1);
      expect(selectedValue).toBe(0);

      context.dispatch("tagix/action/Increment", { amount: 5 });

      expect(stateChanges).toBe(2);
      expect(selectedValue).toBe(5);
      expect(getValue(context.getCurrent())).toBe(5);

      context.dispatch("tagix/action/Increment", { amount: 5 });

      expect(getValue(context.getCurrent())).toBe(10);
      expect(stateChanges).toBe(3);

      const userContext = context.provide("user", { name: "Alice", role: "admin" });
      const user = userContext.get<{ name: string; role: string }>("user");
      expect(isSome(user)).toBe(true);
      expect(unwrap(user)).toEqual({ name: "Alice", role: "admin" });

      const computedContext = context.provide("computed", (parent) => ({
        doubled: getValue(parent) * 2,
        squared: getValue(parent) ** 2,
      }));
      const computed = computedContext.get<{ doubled: number; squared: number }>("computed");
      expect(isSome(computed)).toBe(true);
      expect(unwrap(computed)).toEqual({ doubled: 20, squared: 100 });

      const { promise, unsubscribe } = context.selectAsync((state) => getValue(state));
      await expect(promise).resolves.toBe(10);
      unsubscribe();

      const fork = context.fork();
      fork.dispatch("tagix/action/Increment", { amount: 100 });
      expect(getValue(fork.getCurrent())).toBe(110);

      context.dispose();

      expect(context.isDisposed).toBe(true);
    });
  });
});
