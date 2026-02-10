---
category: State Management
---

<p align="center">
  <img src="../../../public/tagix-logo.svg" alt="Tagix Logo" height="128" />
</p>

# Derived Stores

Create read-only stores that automatically compute their state based on other source stores. Updates are memoized and only propagate when the derived value structure changes.

## Usage

```ts
import { createStore, deriveStore, taggedEnum } from "tagix";

const CartState = taggedEnum({
  HasItems: { items: [] as { name: string; price: number }[] },
  Empty: {},
});

const DiscountState = taggedEnum({
  None: { rate: 0 },
  Active: { rate: 0, code: "" },
});

const cart = createStore(CartState.HasItems({ items: [{ name: "Shoes", price: 100 }] }), CartState);
const discount = createStore(DiscountState.None({ rate: 0 }), DiscountState);

const derived = deriveStore([cart, discount], ([cartState, discountState]) => {
  if (cartState._tag === "HasItems") {
    const subtotal = cartState.items.reduce((sum, i) => sum + i.price, 0);
    const rate = discountState._tag === "Active" ? discountState.rate : 0;
    return { total: subtotal * (1 - rate) };
  }
  return { total: 0 };
});

console.log(derived.stateValue); // { total: 100 }
```

## deriveStore()

Factory function to create a `DerivedStore`. Supports combining up to 5 source stores.

### Signature

```ts
function deriveStore<R>(
  sources: readonly AnyTaggedStore[],
  deriver: (...states: any[]) => R,
  config?: DerivedStoreConfig<R>
): DerivedStore<R>;
```

- **sources**: Array of source stores to listen to.
- **deriver**: Function that receives current states of all sources and returns the derived value.
- **config**: Optional configuration (e.g., custom equality function).

## Reactive Updates

Derived stores automatically recompute when any source store updates.

```ts
cart.setState(
  CartState.HasItems({
    items: [
      { name: "Hat", price: 25 },
      { name: "Scarf", price: 15 },
    ],
  })
);

console.log(derived.stateValue); // { total: 40 }
```

## Memoization

Updates are memoized by default using deep equality. Subscribers are NOT notified if the computed value is structurally identical.

```ts
const derived = deriveStore([cart], ([cartState]) => ({
  count: cartState._tag === "HasItems" ? cartState.items.length : 0,
}));

derived.subscribe((val) => console.log(val));

// Changing items but keeping count same triggers NO notification
cart.setState(CartState.HasItems({ items: [{ name: "Different", price: 99 }] }));
```

## Error Handling

Errors thrown inside the deriver function are caught and stored. They are thrown later when accessing `stateValue` or during recomputation (caught by the store's error handling).

```ts
const derived = deriveStore([cart], ([cartState]) => {
  if (cartState._tag === "Error") throw new Error("Invalid State");
  return cartState;
});

try {
  const value = derived.stateValue;
} catch (e) {
  console.error("Derivation failed:", e.message);
}
```

## Diamond Dependencies

Correctly handles scenarios where a derived store depends on multiple sources that update simultaneously or depend on a common ancestor, ensuring consistent updates.

```ts
// Both derived stores from same sources update consistently
const itemCount = deriveStore([cart], ...);
const total = deriveStore([cart, discount], ...);
```

## Related

- [createStore](../core/index.ts) - Source stores
- [taggedEnum](../../lib/Data/tagged-enum.ts) - State definitions
