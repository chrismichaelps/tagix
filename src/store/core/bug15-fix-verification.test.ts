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

import { describe, it, expect, vi } from "vitest";
import { createStore, createAction, createAsyncAction, taggedEnum } from "../index";

const CounterState = taggedEnum({
  Idle: { value: 0 },
  Loading: {},
  Success: { value: 0 },
  Error: { message: "" },
});

type CounterStateType = typeof CounterState.State;

describe("BUG 15 Fix Verification: Subscriber Exception Handling", () => {
  describe("Core Functionality", () => {
    it("should continue notifying all subscribers even if one throws", () => {
      const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

      const increment = createAction<{ amount: number }, CounterStateType>("Increment")
        .withPayload({ amount: 1 })
        .withState((s, p) => {
          const state = s as Extract<CounterStateType, { value: number }>;
          return { ...s, value: state.value + p.amount } as CounterStateType;
        });

      store.register("Increment", increment);

      const callback1 = vi.fn();
      const callback2 = vi.fn().mockImplementation(() => {
        throw new Error("Subscriber 2 error");
      });
      const callback3 = vi.fn();

      store.subscribe(callback1);
      store.subscribe(callback2);
      store.subscribe(callback3);

      store.dispatch("tagix/action/Increment", { amount: 5 });

      expect(callback1).toHaveBeenCalledTimes(2);
      expect(callback2).toHaveBeenCalledTimes(2);
      expect(callback3).toHaveBeenCalledTimes(2);
    });

    it("should record error when subscriber throws", () => {
      const store = createStore(CounterState.Idle({ value: 0 }), CounterState, {
        name: "TestStore",
      });

      const noop = createAction<never, CounterStateType>("Noop").withState((s) => s);

      store.register("Noop", noop);

      store.subscribe((_state) => {
        throw new Error("Test subscriber error");
      });

      store.dispatch("tagix/action/Noop", undefined);

      expect(store.lastError).toBeDefined();
    });

    it("should update state correctly even with throwing subscribers", () => {
      const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

      const increment = createAction<{ amount: number }, CounterStateType>("Increment")
        .withPayload({ amount: 1 })
        .withState((s, p) => {
          const state = s as Extract<CounterStateType, { value: number }>;
          return { ...s, value: state.value + p.amount } as CounterStateType;
        });

      store.register("Increment", increment);

      const normalCallback = vi.fn();
      const throwingCallback = vi.fn().mockImplementation(() => {
        throw new Error("Intermediary error");
      });

      store.subscribe(normalCallback);
      store.subscribe(throwingCallback);

      store.dispatch("tagix/action/Increment", { amount: 5 });

      expect(store.stateValue.value).toBe(5);
      expect(normalCallback).toHaveBeenCalledTimes(2);
      expect(throwingCallback).toHaveBeenCalledTimes(2);
    });

    it("should not crash when all subscribers throw", () => {
      const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

      const increment = createAction<{ amount: number }, CounterStateType>("Increment")
        .withPayload({ amount: 1 })
        .withState((s, p) => {
          const state = s as Extract<CounterStateType, { value: number }>;
          return { ...s, value: state.value + p.amount } as CounterStateType;
        });

      store.register("Increment", increment);

      const throw1 = vi.fn().mockImplementation(() => {
        throw new Error("Error 1");
      });
      const throw2 = vi.fn().mockImplementation(() => {
        throw new Error("Error 2");
      });
      const throw3 = vi.fn().mockImplementation(() => {
        throw new Error("Error 3");
      });

      store.subscribe(throw1);
      store.subscribe(throw2);
      store.subscribe(throw3);

      expect(() => {
        store.dispatch("tagix/action/Increment", { amount: 1 });
      }).not.toThrow();

      expect(store.stateValue.value).toBe(1);
      expect(throw1).toHaveBeenCalledTimes(2);
      expect(throw2).toHaveBeenCalledTimes(2);
      expect(throw3).toHaveBeenCalledTimes(2);
    });

    it("should capture the last error correctly", () => {
      const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

      const noop = createAction<never, CounterStateType>("Noop").withState((s) => s);

      store.register("Noop", noop);

      const firstError = vi.fn().mockImplementation(() => {
        throw new Error("First error");
      });
      const secondError = vi.fn().mockImplementation(() => {
        throw new Error("Second error");
      });

      store.subscribe(firstError);
      store.subscribe(secondError);

      store.dispatch("tagix/action/Noop", undefined);

      expect(secondError).toHaveBeenCalledTimes(2);
      expect(firstError).toHaveBeenCalledTimes(2);
    });

    it("should handle error in subscribe callback and still notify during dispatch", () => {
      const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

      const increment = createAction<{ amount: number }, CounterStateType>("Increment")
        .withPayload({ amount: 1 })
        .withState((s, p) => {
          const state = s as Extract<CounterStateType, { value: number }>;
          return { ...s, value: state.value + p.amount } as CounterStateType;
        });

      store.register("Increment", increment);

      const errorOnSubscribe = vi.fn().mockImplementation(() => {
        throw new Error("Subscribe error");
      });
      const normalSubscribe = vi.fn();
      const dispatchCallback = vi.fn();

      store.subscribe(errorOnSubscribe);
      store.subscribe(normalSubscribe);
      store.subscribe(dispatchCallback);

      expect(errorOnSubscribe).toHaveBeenCalledTimes(1);
      expect(normalSubscribe).toHaveBeenCalledTimes(1);
      expect(dispatchCallback).toHaveBeenCalledTimes(1);

      store.dispatch("tagix/action/Increment", { amount: 10 });
      expect(store.stateValue.value).toBe(10);
    });

    it("should handle multiple dispatches with throwing subscribers", () => {
      const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

      const increment = createAction<{ amount: number }, CounterStateType>("Increment")
        .withPayload({ amount: 1 })
        .withState((s, p) => {
          const state = s as Extract<CounterStateType, { value: number }>;
          return { ...s, value: state.value + p.amount } as CounterStateType;
        });

      store.register("Increment", increment);

      const thrower = vi.fn().mockImplementation(() => {
        throw new Error("Always throws");
      });
      const counter = vi.fn();

      store.subscribe(thrower);
      store.subscribe(counter);

      store.dispatch("tagix/action/Increment", { amount: 1 });
      expect(store.stateValue.value).toBe(1);
      expect(thrower).toHaveBeenCalledTimes(2);
      expect(counter).toHaveBeenCalledTimes(2);

      store.dispatch("tagix/action/Increment", { amount: 2 });
      expect(store.stateValue.value).toBe(3);
      expect(thrower).toHaveBeenCalledTimes(3);
      expect(counter).toHaveBeenCalledTimes(3);
    });
  });

  describe("Real-World Scenarios", () => {
    describe("Analytics and Logging", () => {
      it("should handle failing analytics subscriber without breaking UI updates", () => {
        const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

        const increment = createAction<{ amount: number }, CounterStateType>("Increment")
          .withPayload({ amount: 1 })
          .withState((s, p) => {
            const state = s as Extract<CounterStateType, { value: number }>;
            return { ...s, value: state.value + p.amount } as CounterStateType;
          });

        store.register("Increment", increment);

        const analytics = vi.fn().mockImplementation(() => {
          throw new Error("Analytics API failed");
        });
        const uiUpdate = vi.fn();
        const logger = vi.fn().mockImplementation(() => {
          throw new Error("Logger unavailable");
        });

        store.subscribe(analytics);
        store.subscribe(uiUpdate);
        store.subscribe(logger);

        store.dispatch("tagix/action/Increment", { amount: 10 });

        expect(store.stateValue.value).toBe(10);
        expect(uiUpdate).toHaveBeenCalledTimes(2);
        expect(analytics).toHaveBeenCalledTimes(2);
        expect(logger).toHaveBeenCalledTimes(2);
      });

      it("should handle logging subscriber with network errors", () => {
        const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

        const increment = createAction<{ amount: number }, CounterStateType>("Increment")
          .withPayload({ amount: 1 })
          .withState((s, p) => {
            const state = s as Extract<CounterStateType, { value: number }>;
            return { ...s, value: state.value + p.amount } as CounterStateType;
          });

        store.register("Increment", increment);

        const networkLogger = vi.fn().mockImplementation(() => {
          throw new Error("Network error: Cannot connect to logging service");
        });
        const localLogger = vi.fn().mockImplementation(() => {
          throw new Error("Local storage full");
        });
        const ui = vi.fn();

        store.subscribe(networkLogger);
        store.subscribe(localLogger);
        store.subscribe(ui);

        store.dispatch("tagix/action/Increment", { amount: 5 });

        expect(store.stateValue.value).toBe(5);
        expect(ui).toHaveBeenCalledTimes(2);
      });
    });

    describe("UI Component Subscribers", () => {
      it("should handle multiple UI components with one failing", () => {
        const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

        const increment = createAction<{ amount: number }, CounterStateType>("Increment")
          .withPayload({ amount: 1 })
          .withState((s, p) => {
            const state = s as Extract<CounterStateType, { value: number }>;
            return { ...s, value: state.value + p.amount } as CounterStateType;
          });

        store.register("Increment", increment);

        const headerComponent = vi.fn();
        const sidebarComponent = vi.fn().mockImplementation(() => {
          throw new Error("Sidebar render failed");
        });
        const mainContent = vi.fn();
        const footerComponent = vi.fn().mockImplementation(() => {
          throw new Error("Footer render error");
        });
        const toolbar = vi.fn();

        store.subscribe(headerComponent);
        store.subscribe(sidebarComponent);
        store.subscribe(mainContent);
        store.subscribe(footerComponent);
        store.subscribe(toolbar);

        store.dispatch("tagix/action/Increment", { amount: 3 });

        expect(store.stateValue.value).toBe(3);
        expect(headerComponent).toHaveBeenCalledTimes(2);
        expect(sidebarComponent).toHaveBeenCalledTimes(2);
        expect(mainContent).toHaveBeenCalledTimes(2);
        expect(footerComponent).toHaveBeenCalledTimes(2);
        expect(toolbar).toHaveBeenCalledTimes(2);
      });

      it("should handle React useEffect-style subscriptions with errors", () => {
        const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

        const increment = createAction<{ amount: number }, CounterStateType>("Increment")
          .withPayload({ amount: 1 })
          .withState((s, p) => {
            const state = s as Extract<CounterStateType, { value: number }>;
            return { ...s, value: state.value + p.amount } as CounterStateType;
          });

        store.register("Increment", increment);

        const useEffect1 = vi.fn().mockImplementation(() => {
          throw new Error("useEffect1 error");
        });
        const useEffect2 = vi.fn();
        const useEffect3 = vi.fn().mockImplementation(() => {
          throw new Error("useEffect3 error");
        });

        store.subscribe(useEffect1);
        store.subscribe(useEffect2);
        store.subscribe(useEffect3);

        store.dispatch("tagix/action/Increment", { amount: 2 });

        expect(store.stateValue.value).toBe(2);
        expect(useEffect2).toHaveBeenCalledTimes(2);
      });

      it("should handle selectors with validation errors", () => {
        const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

        const increment = createAction<{ amount: number }, CounterStateType>("Increment")
          .withPayload({ amount: 1 })
          .withState((s, p) => {
            const state = s as Extract<CounterStateType, { value: number }>;
            return { ...s, value: state.value + p.amount } as CounterStateType;
          });

        store.register("Increment", increment);

        const validSelector = vi.fn();
        const invalidSelector = vi.fn().mockImplementation(() => {
          throw new Error("Selector validation failed: missing required field");
        });
        const derivedSelector = vi.fn();

        store.subscribe(validSelector);
        store.subscribe(invalidSelector);
        store.subscribe(derivedSelector);

        store.dispatch("tagix/action/Increment", { amount: 7 });

        expect(store.stateValue.value).toBe(7);
        expect(validSelector).toHaveBeenCalledTimes(2);
        expect(invalidSelector).toHaveBeenCalledTimes(2);
        expect(derivedSelector).toHaveBeenCalledTimes(2);
      });
    });

    describe("Error Boundary Scenarios", () => {
      it("should isolate errors in one subscriber without affecting others", () => {
        const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

        const increment = createAction<{ amount: number }, CounterStateType>("Increment")
          .withPayload({ amount: 1 })
          .withState((s, p) => {
            const state = s as Extract<CounterStateType, { value: number }>;
            return { ...s, value: state.value + p.amount } as CounterStateType;
          });

        store.register("Increment", increment);

        const errorBoundary1 = vi.fn().mockImplementation(() => {
          throw new Error("Component A crashed");
        });
        const errorBoundary2 = vi.fn();
        const errorBoundary3 = vi.fn().mockImplementation(() => {
          throw new Error("Component C crashed");
        });
        const errorBoundary4 = vi.fn();

        store.subscribe(errorBoundary1);
        store.subscribe(errorBoundary2);
        store.subscribe(errorBoundary3);
        store.subscribe(errorBoundary4);

        store.dispatch("tagix/action/Increment", { amount: 4 });

        expect(store.stateValue.value).toBe(4);
        expect(errorBoundary2).toHaveBeenCalledTimes(2);
        expect(errorBoundary4).toHaveBeenCalledTimes(2);
      });

      it("should handle unsubscribing after error", () => {
        const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

        const increment = createAction<{ amount: number }, CounterStateType>("Increment")
          .withPayload({ amount: 1 })
          .withState((s, p) => {
            const state = s as Extract<CounterStateType, { value: number }>;
            return { ...s, value: state.value + p.amount } as CounterStateType;
          });

        store.register("Increment", increment);

        const failingSubscriber = vi.fn().mockImplementation(() => {
          throw new Error("Failing subscriber");
        });
        const normalSubscriber = vi.fn();

        store.subscribe(normalSubscriber);
        const unsubscribe = store.subscribe(failingSubscriber);

        store.dispatch("tagix/action/Increment", { amount: 1 });
        expect(store.stateValue.value).toBe(1);
        expect(failingSubscriber).toHaveBeenCalledTimes(2);
        expect(normalSubscriber).toHaveBeenCalledTimes(2);

        unsubscribe();

        store.dispatch("tagix/action/Increment", { amount: 2 });
        expect(store.stateValue.value).toBe(3);
        expect(failingSubscriber).toHaveBeenCalledTimes(2);
        expect(normalSubscriber).toHaveBeenCalledTimes(3);
      });
    });

    describe("Async Action Scenarios", () => {
      it("should handle errors during async action notifications", async () => {
        const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

        const asyncIncrement = createAsyncAction<{ amount: number }, CounterStateType, number>(
          "AsyncIncrement"
        )
          .state((s) => CounterState.Loading({}))
          .effect(async (p) => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            return p.amount * 2;
          })
          .onSuccess((_s, result) => {
            const state = _s as Extract<CounterStateType, { value: number }>;
            return CounterState.Success({
              value: state.value + result,
            }) as unknown as CounterStateType;
          })
          .onError((s, _err) => s);

        store.register("AsyncIncrement", asyncIncrement);

        const uiSubscriber = vi.fn();
        const loggingSubscriber = vi.fn().mockImplementation(() => {
          throw new Error("Logging failed");
        });
        const analyticsSubscriber = vi.fn().mockImplementation(() => {
          throw new Error("Analytics error");
        });

        store.subscribe(uiSubscriber);
        store.subscribe(loggingSubscriber);
        store.subscribe(analyticsSubscriber);

        await store.dispatch("tagix/action/AsyncIncrement", { amount: 5 });

        expect(uiSubscriber).toHaveBeenCalled();
        expect(loggingSubscriber).toHaveBeenCalled();
        expect(analyticsSubscriber).toHaveBeenCalled();
      });

      it("should handle rapid successive dispatches with failing subscribers", () => {
        const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

        const increment = createAction<{ amount: number }, CounterStateType>("Increment")
          .withPayload({ amount: 1 })
          .withState((s, p) => {
            const state = s as Extract<CounterStateType, { value: number }>;
            return { ...s, value: state.value + p.amount } as CounterStateType;
          });

        store.register("Increment", increment);

        const unstableSubscriber = vi.fn().mockImplementation(() => {
          throw new Error("Unstable");
        });
        const stableSubscriber = vi.fn();

        store.subscribe(unstableSubscriber);
        store.subscribe(stableSubscriber);

        for (let i = 0; i < 10; i++) {
          store.dispatch("tagix/action/Increment", { amount: 1 });
        }

        expect(store.stateValue.value).toBe(10);
        expect(stableSubscriber).toHaveBeenCalledTimes(11);
        expect(unstableSubscriber).toHaveBeenCalledTimes(11);
      });
    });

    describe("Memory and Cleanup", () => {
      it("should handle subscribers that throw on every call", () => {
        const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

        const increment = createAction<{ amount: number }, CounterStateType>("Increment")
          .withPayload({ amount: 1 })
          .withState((s, p) => {
            const state = s as Extract<CounterStateType, { value: number }>;
            return { ...s, value: state.value + p.amount } as CounterStateType;
          });

        store.register("Increment", increment);

        let callCount = 0;
        const alwaysThrows = vi.fn().mockImplementation(() => {
          callCount++;
          throw new Error(`Error ${callCount}`);
        });

        store.subscribe(alwaysThrows);

        store.dispatch("tagix/action/Increment", { amount: 1 });
        store.dispatch("tagix/action/Increment", { amount: 2 });
        store.dispatch("tagix/action/Increment", { amount: 3 });

        expect(store.stateValue.value).toBe(6);
        expect(callCount).toBe(4);
        expect(store.getTotalErrorCount()).toBe(4);
      });

      it("should handle mix of adding/removing subscribers with errors", () => {
        const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

        const increment = createAction<{ amount: number }, CounterStateType>("Increment")
          .withPayload({ amount: 1 })
          .withState((s, p) => {
            const state = s as Extract<CounterStateType, { value: number }>;
            return { ...s, value: state.value + p.amount } as CounterStateType;
          });

        store.register("Increment", increment);

        const sub1 = vi.fn().mockImplementation(() => {
          throw new Error("Sub1 error");
        });
        const sub2 = vi.fn();
        const sub3 = vi.fn().mockImplementation(() => {
          throw new Error("Sub3 error");
        });

        const unsub1 = store.subscribe(sub1);
        store.subscribe(sub2);
        const unsub3 = store.subscribe(sub3);

        store.dispatch("tagix/action/Increment", { amount: 1 });

        unsub1();
        unsub3();

        store.dispatch("tagix/action/Increment", { amount: 2 });

        expect(store.stateValue.value).toBe(3);
        expect(sub1).toHaveBeenCalledTimes(2);
        expect(sub2).toHaveBeenCalledTimes(3);
        expect(sub3).toHaveBeenCalledTimes(2);
      });
    });

    describe("Edge Cases", () => {
      it("should handle subscriber that throws on initial call only", () => {
        const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

        const increment = createAction<{ amount: number }, CounterStateType>("Increment")
          .withPayload({ amount: 1 })
          .withState((s, p) => {
            const state = s as Extract<CounterStateType, { value: number }>;
            return { ...s, value: state.value + p.amount } as CounterStateType;
          });

        store.register("Increment", increment);

        let firstCall = true;
        const recoverSubscriber = vi.fn().mockImplementation(() => {
          if (firstCall) {
            firstCall = false;
            throw new Error("First call error");
          }
        });
        const normalSubscriber = vi.fn();

        store.subscribe(recoverSubscriber);
        store.subscribe(normalSubscriber);

        store.dispatch("tagix/action/Increment", { amount: 5 });

        expect(store.stateValue.value).toBe(5);
        expect(recoverSubscriber).toHaveBeenCalledTimes(2);
        expect(normalSubscriber).toHaveBeenCalledTimes(2);
      });

      it("should handle very long chains of subscribers with interspersed errors", () => {
        const store = createStore(CounterState.Idle({ value: 0 }), CounterState);

        const increment = createAction<{ amount: number }, CounterStateType>("Increment")
          .withPayload({ amount: 1 })
          .withState((s, p) => {
            const state = s as Extract<CounterStateType, { value: number }>;
            return { ...s, value: state.value + p.amount } as CounterStateType;
          });

        store.register("Increment", increment);

        const subscribers: ReturnType<typeof vi.fn>[] = [];
        for (let i = 0; i < 20; i++) {
          const sub = vi.fn().mockImplementation(() => {
            if (i % 3 === 0) {
              throw new Error(`Subscriber ${i} failed`);
            }
          });
          store.subscribe(sub);
          subscribers.push(sub);
        }

        store.dispatch("tagix/action/Increment", { amount: 1 });

        expect(store.stateValue.value).toBe(1);
        subscribers.forEach((sub) => {
          expect(sub).toHaveBeenCalledTimes(2);
        });
      });
    });
  });
});
