---
category: State Management
alias: state-machines
title: State Machines
description: Model state transitions as finite state machines
keywords:
  - state machines
  - transitions
  - finite state
sidebar:
  position: 4
  label: State Machines
  icon: diagram-2
tags:
  - state-machines
  - transitions
author: Tagix Team
last_updated: 2026-02-02
version: 1.0.0
draft: false
pagination_prev: 12-async-actions
pagination_next: null
head:
  - tag: meta
    attrs:
      property: og:type
      content: article
  - tag: meta
    attrs:
      property: og:title
      content: State Machines - Tagix
  - tag: meta
    attrs:
      property: og:description
      content: Build state machines with Tagix
  - tag: meta
    attrs:
      property: og:image
      content: @public/tagix-logo.png
code_annotations: true
line_numbers: true
hide_table_of_contents: false
toc_max_heading_level: 3
lang: en
dir: ltr
level: intermediate
---

# State Machines

Model state transitions as finite state machines.

## State Machine Pattern

Tagix state definitions naturally model finite state machines:

```ts
const OrderState = taggedEnum({
  Pending: {},
  Processing: { startedAt: string },
  Shipped: { trackingNumber: string; shippedAt: string },
  Delivered: { deliveredAt: string },
  Cancelled: { reason: string; cancelledAt: string },
});
```

## Valid Transitions

Define which transitions are allowed:

```ts
const OrderActions = {
  submit: createAction<void, OrderState>("Submit")
    .withPayload(undefined)
    .withState((s) => {
      if (s._tag !== "Pending") return s;
      return OrderState.Processing({ startedAt: new Date().toISOString() });
    }),

  ship: createAction<{ trackingNumber: string }, OrderState>("Ship")
    .withPayload({ trackingNumber: "" })
    .withState((s, p) => {
      if (s._tag !== "Processing") return s;
      return OrderState.Shipped({
        trackingNumber: p.trackingNumber,
        shippedAt: new Date().toISOString(),
      });
    }),

  deliver: createAction<void, OrderState>("Deliver")
    .withPayload(undefined)
    .withState((s) => {
      if (s._tag !== "Shipped") return s;
      return OrderState.Delivered({ deliveredAt: new Date().toISOString() });
    }),

  cancel: createAction<{ reason: string }, OrderState>("Cancel")
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

const safeTransition = createAction<{ to: string }, OrderState>("Transition")
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
const validateOrder = (state: OrderState): boolean => {
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
    method: "card" | "bank" | "crypto";
    attempts: number;
  },
  Completed: { transactionId: string },
  Failed: { reason: string; retryable: boolean },
  Refunded: { refundId: string; reason: string },
});
```

## Side Effects on Transition

Trigger actions during transitions:

```ts
const withSideEffects = (action: Action) =>
  createAction(action.type, action.payload)
    .withState(action.withState)
    .withEffect(async (payload) => {
      // Side effect after state transition
      await sendAnalytics("action_completed", payload);
      await notifyWebhook(payload);
    });
```

## See Also

- [State Definitions](10-state-definitions.md) - State structure
- [Actions](11-actions.md) - State transitions
- [Async Actions](12-async-actions.md) - Async transitions
