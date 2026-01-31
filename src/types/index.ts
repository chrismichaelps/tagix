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

export interface ActionDescriptor<TPayload = unknown, TState = unknown> {
  readonly type: string;
  readonly payload: TPayload;
  readonly handler: (state: TState, payload: TPayload) => TState;
}

export interface AsyncActionDescriptor<TPayload = unknown, TState = unknown, TError = unknown> {
  readonly type: string;
  readonly payload: TPayload;
  readonly state: (currentState: TState) => TState;
  readonly effect: (payload: TPayload) => Promise<unknown>;
  readonly onSuccess: (currentState: TState, result: unknown) => TState;
  readonly onError: (currentState: TState, error: TError) => TState;
}

export interface MiddlewareContext<S> {
  getState: () => S;
  dispatch: <T extends ActionDescriptor | AsyncActionDescriptor>(action: T) => void;
  subscribe: (callback: (state: S) => void) => () => void;
}

export type Middleware<S> = (
  context: MiddlewareContext<S>
) => (next: (action: unknown) => void) => (action: unknown) => void;

export interface PersistenceConfig<S> {
  readonly key: string;
  readonly filter?: (key: string) => boolean;
  readonly migrate?: (oldState: unknown) => S;
}

export interface ErrorsConfig {
  readonly maxHistory?: number;
  readonly autoClearOnNavigation?: boolean;
}

export interface DevToolsConfig<S> {
  readonly enabled?: boolean;
  readonly name?: string;
  readonly actionSanitizer?: (action: ActionDescriptor) => ActionDescriptor;
  readonly stateSanitizer?: (state: S) => S;
}

export interface SnapshotConfig<S> {
  readonly enabled?: boolean;
  readonly maxSnapshots?: number;
  readonly autoSnapshot?: (action: ActionDescriptor) => boolean;
}

export interface UndoRedoConfig<S> {
  readonly enabled?: boolean;
  readonly maxHistory?: number;
  readonly trackActions?: (action: ActionDescriptor) => boolean;
}

export interface StoreConfig<S> {
  readonly name?: string;
  readonly persistence?: PersistenceConfig<S>;
  readonly errors?: ErrorsConfig;
  readonly devTools?: DevToolsConfig<S>;
  readonly snapshot?: SnapshotConfig<S>;
  readonly undoRedo?: UndoRedoConfig<S>;
  readonly strict?: boolean;
}

export type TaggedState<T extends { readonly _tag: string } = { readonly _tag: string }> = T;
