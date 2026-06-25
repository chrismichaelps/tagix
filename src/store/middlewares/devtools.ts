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

import type { Action, AsyncAction, MiddlewareContext } from "../types";

/** A single connection to the Redux DevTools extension (or a compatible mock). */
export interface DevtoolsConnection {
  /** Seeds the DevTools timeline with the initial state. */
  init(state: unknown): void;
  /** Records a dispatched action and the resulting state. */
  send(action: { type: string }, state: unknown): void;
}

/** The DevTools extension entry point — `window.__REDUX_DEVTOOLS_EXTENSION__`. */
export interface DevtoolsConnector {
  connect(options: { name?: string }): DevtoolsConnection;
}

/** Options for {@link createDevtoolsMiddleware}. */
export interface DevtoolsOptions {
  /** Instance name shown in the DevTools dropdown. @default "tagix" */
  name?: string;
  /**
   * The connector to use. Defaults to `globalThis.__REDUX_DEVTOOLS_EXTENSION__`
   * when present; pass a mock in tests or a custom backend.
   */
  connector?: DevtoolsConnector;
}

function defaultConnector(): DevtoolsConnector | null {
  const ext = (globalThis as { __REDUX_DEVTOOLS_EXTENSION__?: DevtoolsConnector })
    .__REDUX_DEVTOOLS_EXTENSION__;
  return ext ?? null;
}

/**
 * Creates middleware that streams dispatched actions and state snapshots to the
 * Redux DevTools extension, giving you the familiar action timeline and state
 * inspector for a tagix store.
 *
 * @param options - See {@link DevtoolsOptions}.
 * @returns A middleware suitable for `StoreConfig.middlewares`.
 *
 * @remarks
 * - When no connector is available (e.g. server-side, or the extension is not
 *   installed) the middleware is an inert pass-through.
 * - Like the logger, this reports the state immediately after the action passes
 *   through the chain; an async action's final (post-effect) state is not a
 *   separate timeline entry.
 *
 * @example
 * ```ts
 * const store = createStore(initialState, AppState, {
 *   middlewares: [createDevtoolsMiddleware({ name: "App" })],
 * });
 * ```
 */
export function createDevtoolsMiddleware(options: DevtoolsOptions = {}) {
  const name = options.name ?? "tagix";
  const connector = options.connector ?? defaultConnector();

  return function devtoolsMiddleware<S extends { readonly _tag: string }>(
    context: MiddlewareContext<S>
  ) {
    const connection = connector ? connector.connect({ name }) : null;
    connection?.init(context.getState());

    return function devtools(next: (action: Action | AsyncAction) => boolean) {
      return function devtoolsExecutor(action: Action | AsyncAction): boolean | void {
        const result = next(action);
        connection?.send({ type: action.type }, context.getState());
        return result;
      };
    };
  };
}
