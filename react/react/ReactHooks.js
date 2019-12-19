/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {
  ReactContext,
  ReactEventResponder,
  ReactEventResponderListener,
} from 'shared/ReactTypes';
import invariant from 'shared/invariant';
import warning from 'shared/warning';
import {REACT_RESPONDER_TYPE} from 'shared/ReactSymbols';

import ReactCurrentDispatcher from './ReactCurrentDispatcher';

function resolveDispatcher() {
  const dispatcher = ReactCurrentDispatcher.current;
  return dispatcher;
}

export function useContext<T>(
  Context: ReactContext<T>,
  unstable_observedBits: number | boolean | void,
) {
  const dispatcher = resolveDispatcher();
  return dispatcher.useContext(Context, unstable_observedBits);
}

export function useState<S>(initialState: (() => S) | S) {
  const dispatcher = resolveDispatcher();
  return dispatcher.useState(initialState);
}

export function useReducer<S, I, A>(
  reducer: (S, A) => S,
  initialArg: I,
  init?: I => S,
) {
  const dispatcher = resolveDispatcher();
  return dispatcher.useReducer(reducer, initialArg, init);
}

export function useRef<T>(initialValue: T): {current: T} {
  const dispatcher = resolveDispatcher();
  return dispatcher.useRef(initialValue);
}

export function useEffect(
  create: () => (() => void) | void,
  inputs: Array<mixed> | void | null,
) {
  const dispatcher = resolveDispatcher();
  return dispatcher.useEffect(create, inputs);
}

export function useLayoutEffect(
  create: () => (() => void) | void,
  inputs: Array<mixed> | void | null,
) {
  const dispatcher = resolveDispatcher();
  return dispatcher.useLayoutEffect(create, inputs);
}

export function useCallback(
  callback: () => mixed,
  inputs: Array<mixed> | void | null,
) {
  const dispatcher = resolveDispatcher();
  return dispatcher.useCallback(callback, inputs);
}

export function useMemo(
  create: () => mixed,
  inputs: Array<mixed> | void | null,
) {
  const dispatcher = resolveDispatcher();
  return dispatcher.useMemo(create, inputs);
}

export function useImperativeHandle<T>(
  ref: {current: T | null} | ((inst: T | null) => mixed) | null | void,
  create: () => T,
  inputs: Array<mixed> | void | null,
): void {
  const dispatcher = resolveDispatcher();
  return dispatcher.useImperativeHandle(ref, create, inputs);
}

export function useDebugValue(value: any, formatterFn: ?(value: any) => any) {
  if (__DEV__) {
    const dispatcher = resolveDispatcher();
    return dispatcher.useDebugValue(value, formatterFn);
  }
}

export const emptyObject = {};

export function useResponder(
  responder: ReactEventResponder<any, any>,
  listenerProps: ?Object,
): ?ReactEventResponderListener<any, any> {
  const dispatcher = resolveDispatcher();
  return dispatcher.useResponder(responder, listenerProps || emptyObject);
}
