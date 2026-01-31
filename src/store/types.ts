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

export interface StoreConfig<S extends { readonly _tag: string }> {
  readonly name?: string;
  readonly strict?: boolean;
  readonly maxErrorHistory?: number;
  readonly maxSnapshots?: number;
  readonly maxUndoHistory?: number;
  readonly middlewares?: Array<Middleware<S>>;
}

export interface Action<TPayload = never, TState = never> {
  readonly type: string;
  readonly payload: TPayload;
  readonly handler: (state: TState, payload: TPayload) => TState;
}

export interface AsyncAction<TPayload = never, TState = never, TError = never> {
  readonly type: string;
  readonly payload: TPayload;
  readonly state: (currentState: TState) => TState;
  readonly effect: (payload: TPayload) => Promise<unknown>;
  readonly onSuccess: (currentState: TState, result: unknown) => TState;
  readonly onError: (currentState: TState, error: TError) => TState;
}

export interface MiddlewareContext<S extends { readonly _tag: string }> {
  readonly getState: () => S;
  readonly dispatch: <TPayload>(type: string, payload: TPayload) => void;
  readonly subscribe: (callback: (state: S) => void) => () => void;
}

export type Middleware<S extends { readonly _tag: string }> = (
  context: MiddlewareContext<S>
) => (next: (action: Action | AsyncAction) => void) => (action: Action | AsyncAction) => void;

export interface Snapshot<S extends { readonly _tag: string }> {
  readonly name: string;
  readonly state: S;
  readonly timestamp: number;
}

export interface DerivedDefinition<TState extends { readonly _tag: string }, TValue> {
  readonly key: string;
  readonly compute: (state: TState) => TValue;
}

export type SubscribeCallback<S extends { readonly _tag: string }> = (state: S) => void;

export type SubscribePathCallback<T> = (value: T) => void;
