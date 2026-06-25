---
category: State Management
alias: state-machines
title: State Machines
description: Model state transitions as finite state machines
---

# State Machines

Model state transitions as finite state machines.

## State Machine Pattern

Tagix state definitions naturally model finite state machines:

```ts
const OrderState = taggedEnum({
  Pending: {},
  Processing: { startedAt: "" },
  Shipped: { trackingNumber: "", shippedAt: "" },
  Delivered: { deliveredAt: "" },
  Cancelled: { reason: "", cancelledAt: "" },
});

type OrderStateType = typeof OrderState.State;
```

## Valid Transitions

Define which transitions are allowed:

```ts
const OrderActions = {
  submit: createAction<void, OrderStateType>("Submit")
    .withPayload(undefined)
    .withState((s) => {
      if (s._tag !== "Pending") return s;
      return OrderState.Processing({ startedAt: new Date().toISOString() });
    }),

  ship: createAction<{ trackingNumber: string }, OrderStateType>("Ship")
    .withPayload({ trackingNumber: "" })
    .withState((s, p) => {
      if (s._tag !== "Processing") return s;
      return OrderState.Shipped({
        trackingNumber: p.trackingNumber,
        shippedAt: new Date().toISOString(),
      });
    }),

  deliver: createAction<void, OrderStateType>("Deliver")
    .withPayload(undefined)
    .withState((s) => {
      if (s._tag !== "Shipped") return s;
      return OrderState.Delivered({ deliveredAt: new Date().toISOString() });
    }),

  cancel: createAction<{ reason: string }, OrderStateType>("Cancel")
    .withPayload({ reason: "" })
    .withState((s, p) => {
      if (s._tag === "Delivered") return s; // Cannot cancel delivered
      return OrderState.Cancelled({
        reason: p.reason,
        cancelledAt: new Date().toISOString(),
      });
    }),
};
```

## Transition Guard

Prevent invalid transitions:

```ts
const canTransition = (from: string, to: string): boolean => {
  const allowed: Record<string, string[]> = {
    Pending: ["Processing", "Cancelled"],
    Processing: ["Shipped", "Cancelled"],
    Shipped: ["Delivered"],
    Cancelled: [],
    Delivered: [],
  };
  return allowed[from]?.includes(to) ?? false;
};

const safeTransition = createAction<{ to: string }, OrderStateType>("Transition")
  .withPayload({ to: "" })
  .withState((s, p) => {
    if (!canTransition(s._tag, p.to)) return s;
    // Perform transition
    return performTransition(s, p.to);
  });
```

## State Validation

Validate state integrity:

```ts
const validateOrder = (state: OrderStateType): boolean => {
  switch (state._tag) {
    case "Processing":
      return state.startedAt !== undefined;
    case "Shipped":
      return state.trackingNumber.length > 0;
    case "Delivered":
      return state.deliveredAt !== undefined;
    default:
      return true;
  }
};
```

Model complex behaviors:

```ts
const PaymentState = taggedEnum({
  NotStarted: {},
  Processing: {
    method: "card" as "card" | "bank" | "crypto",
    attempts: 0,
  },
  Completed: { transactionId: "" },
  Failed: { reason: "", retryable: true },
  Refunded: { refundId: "", reason: "" },
});
```

## Side Effects on Transition

Trigger actions during transitions:

```ts
const submitOrder = createAsyncAction<{ orderId: string }, OrderStateType, void>("SubmitOrder")
  .state((state) => {
    if (state._tag !== "Pending") return state;
    return OrderState.Processing({ startedAt: new Date().toISOString() });
  })
  .effect(async (payload) => {
    await sendAnalytics("order_submitted", payload);
    await notifyWebhook(payload);
  })
  .onSuccess((state) => state)
  .onError((state, error) =>
    OrderState.Cancelled({
      reason: error instanceof Error ? error.message : String(error),
      cancelledAt: new Date().toISOString(),
    })
  );
```

## See Also

- [State Definitions](10-state-definitions.md) - State structure
- [Actions](11-actions.md) - State transitions
- [Async Actions](12-async-actions.md) - Async transitions
