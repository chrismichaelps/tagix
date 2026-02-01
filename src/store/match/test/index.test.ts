import { describe, it, expect } from "vitest";
import { createStore, matchState, exhaust, taggedEnum } from "../../index";

const CounterState = taggedEnum({
  Idle: { value: 0 },
  Loading: {},
  Ready: { value: 0 },
  Error: { message: "" },
});

type CounterStateType = typeof CounterState.State;

describe("matchState()", () => {
  it("should return value for matching case", () => {
    const store = createStore(CounterState.Ready({ value: 10 }), CounterState, {
      name: "Counter",
    });

    const result = matchState(store.stateValue, {
      Idle: () => "idle",
      Loading: () => "loading",
      Ready: () => "ready",
      Error: () => "error",
    });

    expect(result).toBe("ready");
  });

  it("should return undefined for non-matching cases", () => {
    const store = createStore(CounterState.Ready({ value: 10 }), CounterState, {
      name: "Counter",
    });

    const result = matchState(store.stateValue, {
      Idle: () => "idle",
      Loading: () => "loading",
    });

    expect(result).toBeUndefined();
  });

  it("should work with complex return types", () => {
    const store = createStore(CounterState.Ready({ value: 42 }), CounterState, {
      name: "Counter",
    });

    const result = matchState(store.stateValue, {
      Idle: (s) => `Idle: ${(s as Extract<CounterStateType, { _tag: "Idle" }>).value}`,
      Ready: (s) => `Ready: ${(s as Extract<CounterStateType, { _tag: "Ready" }>).value}`,
      Error: (s) => `Error: ${(s as Extract<CounterStateType, { _tag: "Error" }>).message}`,
    });

    expect(result).toBe("Ready: 42");
  });
});

describe("exhaust()", () => {
  it("should return value for matching case", () => {
    const store = createStore(CounterState.Ready({ value: 10 }), CounterState, {
      name: "Counter",
    });

    const result = exhaust(store.stateValue, {
      Idle: (s) => `Idle: ${(s as Extract<CounterStateType, { _tag: "Idle" }>).value}`,
      Loading: () => "Loading",
      Ready: (s) => `Ready: ${(s as Extract<CounterStateType, { _tag: "Ready" }>).value}`,
      Error: (s) => `Error: ${(s as Extract<CounterStateType, { _tag: "Error" }>).message}`,
    });

    expect(result).toBe("Ready: 10");
  });

  it("should handle all state variants", () => {
    const idleStore = createStore(CounterState.Idle({ value: 0 }), CounterState, {
      name: "Counter",
    });
    const loadingStore = createStore(CounterState.Loading({}), CounterState, {
      name: "Counter",
    });
    const readyStore = createStore(CounterState.Ready({ value: 10 }), CounterState, {
      name: "Counter",
    });
    const errorStore = createStore(CounterState.Error({ message: "fail" }), CounterState, {
      name: "Counter",
    });

    type IdleType = Extract<CounterStateType, { _tag: "Idle" }>;
    type ReadyType = Extract<CounterStateType, { _tag: "Ready" }>;
    type ErrorType = Extract<CounterStateType, { _tag: "Error" }>;

    const mapper = {
      Idle: (s: IdleType) => `Idle:${s.value}`,
      Loading: () => "Loading",
      Ready: (s: ReadyType) => `Ready:${s.value}`,
      Error: (s: ErrorType) => `Error:${s.message}`,
    };

    expect(exhaust(idleStore.stateValue, mapper)).toBe("Idle:0");
    expect(exhaust(loadingStore.stateValue, mapper)).toBe("Loading");
    expect(exhaust(readyStore.stateValue, mapper)).toBe("Ready:10");
    expect(exhaust(errorStore.stateValue, mapper)).toBe("Error:fail");
  });
});

describe("Dynamic Patterns", () => {
  it("should build patterns dynamically", () => {
    const store = createStore(CounterState.Ready({ value: 42 }), CounterState, {
      name: "Counter",
    });

    const createStatusMessage = (showDetails: boolean) => {
      return matchState(store.stateValue, {
        Idle: () => "Ready",
        Loading: () => (showDetails ? "Loading..." : "Working"),
        Ready: (s) =>
          showDetails
            ? `Done: ${(s as Extract<CounterStateType, { _tag: "Ready" }>).value}`
            : "Done",
        Error: (s) =>
          showDetails
            ? `Error: ${(s as Extract<CounterStateType, { _tag: "Error" }>).message}`
            : "Failed",
      });
    };

    expect(createStatusMessage(true)).toBe("Done: 42");
    expect(createStatusMessage(false)).toBe("Done");
  });
});

describe("Complete Match Example", () => {
  it("should work with complete task state example", () => {
    const TaskState = taggedEnum({
      Pending: { retries: 0 },
      Running: { progress: 0 },
      Completed: { result: null },
      Failed: { error: "" },
    });

    type TaskStateType = typeof TaskState.State;

    const store = createStore(TaskState.Running({ progress: 75 }), TaskState, {
      name: "Task",
    });

    const status = matchState(store.stateValue, {
      Pending: () => "Waiting to start",
      Running: (s) => `Progress: ${(s as Extract<TaskStateType, { _tag: "Running" }>).progress}%`,
      Completed: () => "Done!",
    });

    expect(status).toBe("Progress: 75%");

    const statusMessage = exhaust(store.stateValue, {
      Pending: () => "In progress",
      Running: (s) => `${(s as Extract<TaskStateType, { _tag: "Running" }>).progress}% complete`,
      Completed: () => "Finished",
      Failed: (s) => `Failed: ${(s as Extract<TaskStateType, { _tag: "Failed" }>).error}`,
    });

    expect(statusMessage).toBe("75% complete");

    const renderTask = (state: TaskStateType) => {
      return (
        matchState(state, {
          Pending: (s) => `<div>Retries: ${s.retries}</div>`,
          Running: (s) => `<div>Progress: ${s.progress}%</div>`,
          Completed: () => `<div>Done</div>`,
          Failed: (s) => `<div>${s.error}</div>`,
        }) || "<div>Unknown state</div>"
      );
    };

    expect(renderTask(store.stateValue as TaskStateType)).toBe("<div>Progress: 75%</div>");
  });
});
