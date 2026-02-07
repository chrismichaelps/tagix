const taggedEnum = (() => {
  const isRecord = (v) =>
    v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date);
  const isTagged = (tag) => (value) => isRecord(value) && value._tag === tag;

  function createTagConstructor(tag) {
    return (args) => (isRecord(args) ? { _tag: tag, ...args } : { _tag: tag });
  }

  function createIsRefinement(tag) {
    const baseRefinement = isTagged(tag);
    return (value) => baseRefinement(value);
  }

  return function taggedEnum(definition) {
    const cache = new Map();

    return new Proxy(
      {},
      {
        get(_target, prop) {
          if (cache.has(prop)) {
            return cache.get(prop);
          }

          if (prop === "$is") {
            const fn = (tag) => createIsRefinement(tag);
            cache.set(prop, fn);
            return fn;
          }

          if (prop === "$match") {
            const fn = (valueOrCases, maybeCases) => {
              if (maybeCases === undefined) {
                const cases = valueOrCases;
                return (value) => {
                  const handler = cases[value._tag];
                  return handler(value);
                };
              }
              const value = valueOrCases;
              const handler = maybeCases[value._tag];
              return handler(value);
            };
            cache.set(prop, fn);
            return fn;
          }

          if (prop === "State") {
            const stateObj = Object.freeze(
              Object.fromEntries(
                Object.entries(definition).map(([tag, schema]) => [
                  tag,
                  Object.freeze({ ...schema }),
                ])
              )
            );
            cache.set(prop, stateObj);
            return stateObj;
          }

          if (typeof prop === "string") {
            const constructor = createTagConstructor(prop);
            cache.set(prop, constructor);
            return constructor;
          }

          return undefined;
        },
      }
    );
  };
})();

const CounterState = taggedEnum({
  Idle: { value: 0 },
  Loading: {},
  Ready: { value: 0 },
  Error: { message: "", code: 0 },
});

console.log("Testing taggedEnum.State bug #8\n");

console.log("Test 1: State should not return undefined");
const test1 = CounterState.State !== undefined;
console.log(`  CounterState.State === undefined: ${!test1}`);
console.log(`  Result: ${test1 ? "PASS" : "FAIL"}\n`);

console.log("Test 2: State should return an object");
const test2 = typeof CounterState.State === "object" && CounterState.State !== null;
console.log(`  typeof CounterState.State: ${typeof CounterState.State}`);
console.log(`  Result: ${test2 ? "PASS" : "FAIL"}\n`);

console.log("Test 3: State should contain all tag names as keys");
const state = CounterState.State;
const keys = Object.keys(state);
const test3 =
  keys.includes("Idle") &&
  keys.includes("Loading") &&
  keys.includes("Ready") &&
  keys.includes("Error");
console.log(`  Keys: ${JSON.stringify(keys)}`);
console.log(`  Result: ${test3 ? "PASS" : "FAIL"}\n`);

console.log("Test 4: State values should match tag definitions");
const test4 =
  JSON.stringify(state.Idle) === JSON.stringify({ value: 0 }) &&
  JSON.stringify(state.Loading) === JSON.stringify({}) &&
  JSON.stringify(state.Ready) === JSON.stringify({ value: 0 }) &&
  JSON.stringify(state.Error) === JSON.stringify({ message: "", code: 0 });
console.log(`  Idle: ${JSON.stringify(state.Idle)}`);
console.log(`  Loading: ${JSON.stringify(state.Loading)}`);
console.log(`  Ready: ${JSON.stringify(state.Ready)}`);
console.log(`  Error: ${JSON.stringify(state.Error)}`);
console.log(`  Result: ${test4 ? "PASS" : "FAIL"}\n`);

console.log("Test 5: State should be immutable (frozen)");
const test5 = Object.isFrozen(CounterState.State);
console.log(`  Object.isFrozen(CounterState.State): ${test5}`);
console.log(`  Result: ${test5 ? "PASS" : "FAIL"}\n`);

console.log("Test 6: Nested taggedEnum State should work");
const NestedState = taggedEnum({
  A: { nested: { deep: true } },
  B: { nested: { deep: false } },
});
const test6 = NestedState.State !== undefined;
const nestedState = NestedState.State;
const test6b = nestedState.A.nested.deep === true && nestedState.B.nested.deep === false;
console.log(`  NestedState.State !== undefined: ${test6}`);
console.log(`  A.deep === true: ${nestedState.A.nested.deep}`);
console.log(`  B.deep === false: ${nestedState.B.nested.deep}`);
console.log(`  Result: ${test6 && test6b ? "PASS" : "FAIL"}\n`);

console.log("Test 7: Empty taggedEnum State should work");
const EmptyState = taggedEnum({});
const test7 = EmptyState.State !== undefined && Object.keys(EmptyState.State).length === 0;
console.log(`  EmptyState.State !== undefined: ${EmptyState.State !== undefined}`);
console.log(`  Object.keys length: ${Object.keys(EmptyState.State).length}`);
console.log(`  Result: ${test7 ? "PASS" : "FAIL"}\n`);

console.log("Test 8: State should be cached (same reference)");
const state1 = CounterState.State;
const state2 = CounterState.State;
const test8 = state1 === state2;
console.log(`  First access === Second access: ${test8}`);
console.log(`  Result: ${test8 ? "PASS" : "FAIL"}\n`);

console.log("Test 9: Complex nested types");
const ComplexState = taggedEnum({
  User: {
    profile: { name: "", age: 0 },
    preferences: { theme: "dark" },
  },
  Guest: { expiresAt: new Date("2024-01-01") },
});
const test9 = ComplexState.State !== undefined;
const complexState = ComplexState.State;
const test9b =
  JSON.stringify(complexState.User.profile) === JSON.stringify({ name: "", age: 0 }) &&
  JSON.stringify(complexState.User.preferences) === JSON.stringify({ theme: "dark" }) &&
  complexState.Guest.expiresAt instanceof Date;
console.log(`  ComplexState.State !== undefined: ${test9}`);
console.log(`  User.profile: ${JSON.stringify(complexState.User.profile)}`);
console.log(`  User.preferences: ${JSON.stringify(complexState.User.preferences)}`);
console.log(`  Guest.expiresAt instanceof Date: ${complexState.Guest.expiresAt instanceof Date}`);
console.log(`  Result: ${test9 && test9b ? "PASS" : "FAIL"}\n`);

console.log("Test 10: Optional properties");
const OptionalState = taggedEnum({
  Present: { required: "", optional: undefined },
  Absent: { required: "" },
});
const optionalState = OptionalState.State;
const test10 =
  optionalState.Present.optional === undefined && optionalState.Absent.optional === undefined;
console.log(`  Present.optional: ${optionalState.Present.optional}`);
console.log(`  Absent.optional: ${optionalState.Absent.optional}`);
console.log(`  Result: ${test10 ? "PASS" : "FAIL"}\n`);

const allPassed =
  test1 &&
  test2 &&
  test3 &&
  test4 &&
  test5 &&
  test6 &&
  test6b &&
  test7 &&
  test8 &&
  test9 &&
  test9b &&
  test10;
console.log("=".repeat(50));
console.log(`Overall Result: ${allPassed ? "ALL TESTS PASSED ✓" : "SOME TESTS FAILED ✗"}`);
console.log("=".repeat(50));

process.exit(allPassed ? 0 : 1);
