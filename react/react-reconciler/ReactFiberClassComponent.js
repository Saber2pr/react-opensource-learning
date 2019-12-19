/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type { Fiber } from "./ReactFiber"
import type { ExpirationTime } from "./ReactFiberExpirationTime"

import React from "react"
import { Update, Snapshot } from "shared/ReactSideEffectTags"
import {
  debugRenderPhaseSideEffects,
  debugRenderPhaseSideEffectsForStrictMode,
  disableLegacyContext,
  warnAboutDeprecatedLifecycles
} from "shared/ReactFeatureFlags"
import ReactStrictModeWarnings from "./ReactStrictModeWarnings"
import { isMounted } from "react-reconciler/reflection"
import { get as getInstance, set as setInstance } from "shared/ReactInstanceMap"
import shallowEqual from "shared/shallowEqual"
import getComponentName from "shared/getComponentName"
import invariant from "shared/invariant"
import warningWithoutStack from "shared/warningWithoutStack"
import { REACT_CONTEXT_TYPE, REACT_PROVIDER_TYPE } from "shared/ReactSymbols"

import { startPhaseTimer, stopPhaseTimer } from "./ReactDebugFiberPerf"
import { resolveDefaultProps } from "./ReactFiberLazyComponent"
import { StrictMode } from "./ReactTypeOfMode"

import {
  enqueueUpdate,
  processUpdateQueue,
  checkHasForceUpdateAfterProcessing,
  resetHasForceUpdateBeforeProcessing,
  createUpdate,
  ReplaceState,
  ForceUpdate
} from "./ReactUpdateQueue"
import { NoWork } from "./ReactFiberExpirationTime"
import {
  cacheContext,
  getMaskedContext,
  getUnmaskedContext,
  hasContextChanged,
  emptyContextObject
} from "./ReactFiberContext"
import { readContext } from "./ReactFiberNewContext"
import {
  requestCurrentTime,
  computeExpirationForFiber,
  scheduleWork
} from "./ReactFiberWorkLoop"
import { requestCurrentSuspenseConfig } from "./ReactFiberSuspenseConfig"

const fakeInternalInstance = {}
const isArray = Array.isArray

// React.Component uses a shared frozen object by default.
// We'll use it to determine whether we need to initialize legacy refs.
export const emptyRefsObject = new React.Component().refs

let didWarnAboutStateAssignmentForComponent
let didWarnAboutUninitializedState
let didWarnAboutGetSnapshotBeforeUpdateWithoutDidUpdate
let didWarnAboutLegacyLifecyclesAndDerivedState
let didWarnAboutUndefinedDerivedState
let warnOnUndefinedDerivedState
let warnOnInvalidCallback
let didWarnAboutDirectlyAssigningPropsToState
let didWarnAboutContextTypeAndContextTypes
let didWarnAboutInvalidateContextType

export function applyDerivedStateFromProps(
  workInProgress: Fiber,
  ctor: any,
  getDerivedStateFromProps: (props: any, state: any) => any,
  nextProps: any
) {
  const prevState = workInProgress.memoizedState

  const partialState = getDerivedStateFromProps(nextProps, prevState)

  // Merge the partial state and the previous state.
  const memoizedState =
    partialState === null || partialState === undefined
      ? prevState
      : Object.assign({}, prevState, partialState)
  workInProgress.memoizedState = memoizedState

  // Once the update queue is empty, persist the derived state onto the
  // base state.
  const updateQueue = workInProgress.updateQueue
  if (updateQueue !== null && workInProgress.expirationTime === NoWork) {
    updateQueue.baseState = memoizedState
  }
}

const classComponentUpdater = {
  isMounted,
  enqueueSetState(inst, payload, callback) {
    const fiber = getInstance(inst)
    const currentTime = requestCurrentTime()
    const suspenseConfig = requestCurrentSuspenseConfig()
    const expirationTime = computeExpirationForFiber(
      currentTime,
      fiber,
      suspenseConfig
    )

    const update = createUpdate(expirationTime, suspenseConfig)
    update.payload = payload
    if (callback !== undefined && callback !== null) {
      update.callback = callback
    }

    enqueueUpdate(fiber, update)
    scheduleWork(fiber, expirationTime)
  },
  enqueueReplaceState(inst, payload, callback) {
    const fiber = getInstance(inst)
    const currentTime = requestCurrentTime()
    const suspenseConfig = requestCurrentSuspenseConfig()
    const expirationTime = computeExpirationForFiber(
      currentTime,
      fiber,
      suspenseConfig
    )

    const update = createUpdate(expirationTime, suspenseConfig)
    update.tag = ReplaceState
    update.payload = payload

    if (callback !== undefined && callback !== null) {
      update.callback = callback
    }

    enqueueUpdate(fiber, update)
    scheduleWork(fiber, expirationTime)
  },
  enqueueForceUpdate(inst, callback) {
    const fiber = getInstance(inst)
    const currentTime = requestCurrentTime()
    const suspenseConfig = requestCurrentSuspenseConfig()
    const expirationTime = computeExpirationForFiber(
      currentTime,
      fiber,
      suspenseConfig
    )

    const update = createUpdate(expirationTime, suspenseConfig)
    update.tag = ForceUpdate

    if (callback !== undefined && callback !== null) {
      update.callback = callback
    }

    enqueueUpdate(fiber, update)
    scheduleWork(fiber, expirationTime)
  }
}

function checkShouldComponentUpdate(
  workInProgress,
  ctor,
  oldProps,
  newProps,
  oldState,
  newState,
  nextContext
) {
  const instance = workInProgress.stateNode
  if (typeof instance.shouldComponentUpdate === "function") {
    startPhaseTimer(workInProgress, "shouldComponentUpdate")
    const shouldUpdate = instance.shouldComponentUpdate(
      newProps,
      newState,
      nextContext
    )
    stopPhaseTimer()

    return shouldUpdate
  }

  if (ctor.prototype && ctor.prototype.isPureReactComponent) {
    return (
      !shallowEqual(oldProps, newProps) || !shallowEqual(oldState, newState)
    )
  }

  return true
}

function adoptClassInstance(workInProgress: Fiber, instance: any): void {
  instance.updater = classComponentUpdater
  workInProgress.stateNode = instance
  // The instance needs access to the fiber so that it can schedule updates
  setInstance(instance, workInProgress)
}

function constructClassInstance(
  workInProgress: Fiber,
  ctor: any,
  props: any,
  renderExpirationTime: ExpirationTime
): any {
  let isLegacyContextConsumer = false
  let unmaskedContext = emptyContextObject
  let context = emptyContextObject
  const contextType = ctor.contextType

  if (typeof contextType === "object" && contextType !== null) {
    context = readContext((contextType: any))
  } else if (!disableLegacyContext) {
    unmaskedContext = getUnmaskedContext(workInProgress, ctor, true)
    const contextTypes = ctor.contextTypes
    isLegacyContextConsumer =
      contextTypes !== null && contextTypes !== undefined
    context = isLegacyContextConsumer
      ? getMaskedContext(workInProgress, unmaskedContext)
      : emptyContextObject
  }

  const instance = new ctor(props, context)
  const state = (workInProgress.memoizedState =
    instance.state !== null && instance.state !== undefined
      ? instance.state
      : null)
  adoptClassInstance(workInProgress, instance)

  // Cache unmasked context so we can avoid recreating masked context unless necessary.
  // ReactFiberContext usually updates this cache but can't for newly-created instances.
  if (isLegacyContextConsumer) {
    cacheContext(workInProgress, unmaskedContext, context)
  }

  return instance
}

function callComponentWillMount(workInProgress, instance) {
  startPhaseTimer(workInProgress, "componentWillMount")
  const oldState = instance.state

  if (typeof instance.componentWillMount === "function") {
    instance.componentWillMount()
  }
  if (typeof instance.UNSAFE_componentWillMount === "function") {
    instance.UNSAFE_componentWillMount()
  }

  stopPhaseTimer()

  if (oldState !== instance.state) {
    classComponentUpdater.enqueueReplaceState(instance, instance.state, null)
  }
}

function callComponentWillReceiveProps(
  workInProgress,
  instance,
  newProps,
  nextContext
) {
  const oldState = instance.state
  startPhaseTimer(workInProgress, "componentWillReceiveProps")
  if (typeof instance.componentWillReceiveProps === "function") {
    instance.componentWillReceiveProps(newProps, nextContext)
  }
  if (typeof instance.UNSAFE_componentWillReceiveProps === "function") {
    instance.UNSAFE_componentWillReceiveProps(newProps, nextContext)
  }
  stopPhaseTimer()

  if (instance.state !== oldState) {
    classComponentUpdater.enqueueReplaceState(instance, instance.state, null)
  }
}

// Invokes the mount life-cycles on a previously never rendered instance.
function mountClassInstance(
  workInProgress: Fiber,
  ctor: any,
  newProps: any,
  renderExpirationTime: ExpirationTime
): void {
  const instance = workInProgress.stateNode
  instance.props = newProps
  instance.state = workInProgress.memoizedState
  instance.refs = emptyRefsObject

  const contextType = ctor.contextType
  if (typeof contextType === "object" && contextType !== null) {
    instance.context = readContext(contextType)
  } else if (disableLegacyContext) {
    instance.context = emptyContextObject
  } else {
    const unmaskedContext = getUnmaskedContext(workInProgress, ctor, true)
    instance.context = getMaskedContext(workInProgress, unmaskedContext)
  }

  let updateQueue = workInProgress.updateQueue
  if (updateQueue !== null) {
    processUpdateQueue(
      workInProgress,
      updateQueue,
      newProps,
      instance,
      renderExpirationTime
    )
    instance.state = workInProgress.memoizedState
  }

  const getDerivedStateFromProps = ctor.getDerivedStateFromProps
  if (typeof getDerivedStateFromProps === "function") {
    applyDerivedStateFromProps(
      workInProgress,
      ctor,
      getDerivedStateFromProps,
      newProps
    )
    instance.state = workInProgress.memoizedState
  }

  // In order to support react-lifecycles-compat polyfilled components,
  // Unsafe lifecycles should not be invoked for components using the new APIs.
  if (
    typeof ctor.getDerivedStateFromProps !== "function" &&
    typeof instance.getSnapshotBeforeUpdate !== "function" &&
    (typeof instance.UNSAFE_componentWillMount === "function" ||
      typeof instance.componentWillMount === "function")
  ) {
    callComponentWillMount(workInProgress, instance)
    // If we had additional state updates during this life-cycle, let's
    // process them now.
    updateQueue = workInProgress.updateQueue
    if (updateQueue !== null) {
      processUpdateQueue(
        workInProgress,
        updateQueue,
        newProps,
        instance,
        renderExpirationTime
      )
      instance.state = workInProgress.memoizedState
    }
  }

  if (typeof instance.componentDidMount === "function") {
    workInProgress.effectTag |= Update
  }
}

function resumeMountClassInstance(
  workInProgress: Fiber,
  ctor: any,
  newProps: any,
  renderExpirationTime: ExpirationTime
): boolean {
  const instance = workInProgress.stateNode

  const oldProps = workInProgress.memoizedProps
  instance.props = oldProps

  const oldContext = instance.context
  const contextType = ctor.contextType
  let nextContext = emptyContextObject
  if (typeof contextType === "object" && contextType !== null) {
    nextContext = readContext(contextType)
  } else if (!disableLegacyContext) {
    const nextLegacyUnmaskedContext = getUnmaskedContext(
      workInProgress,
      ctor,
      true
    )
    nextContext = getMaskedContext(workInProgress, nextLegacyUnmaskedContext)
  }

  const getDerivedStateFromProps = ctor.getDerivedStateFromProps
  const hasNewLifecycles =
    typeof getDerivedStateFromProps === "function" ||
    typeof instance.getSnapshotBeforeUpdate === "function"

  // Note: During these life-cycles, instance.props/instance.state are what
  // ever the previously attempted to render - not the "current". However,
  // during componentDidUpdate we pass the "current" props.

  // In order to support react-lifecycles-compat polyfilled components,
  // Unsafe lifecycles should not be invoked for components using the new APIs.
  if (
    !hasNewLifecycles &&
    (typeof instance.UNSAFE_componentWillReceiveProps === "function" ||
      typeof instance.componentWillReceiveProps === "function")
  ) {
    if (oldProps !== newProps || oldContext !== nextContext) {
      callComponentWillReceiveProps(
        workInProgress,
        instance,
        newProps,
        nextContext
      )
    }
  }

  resetHasForceUpdateBeforeProcessing()

  const oldState = workInProgress.memoizedState
  let newState = (instance.state = oldState)
  let updateQueue = workInProgress.updateQueue
  if (updateQueue !== null) {
    processUpdateQueue(
      workInProgress,
      updateQueue,
      newProps,
      instance,
      renderExpirationTime
    )
    newState = workInProgress.memoizedState
  }
  if (
    oldProps === newProps &&
    oldState === newState &&
    !hasContextChanged() &&
    !checkHasForceUpdateAfterProcessing()
  ) {
    // If an update was already in progress, we should schedule an Update
    // effect even though we're bailing out, so that cWU/cDU are called.
    if (typeof instance.componentDidMount === "function") {
      workInProgress.effectTag |= Update
    }
    return false
  }

  if (typeof getDerivedStateFromProps === "function") {
    applyDerivedStateFromProps(
      workInProgress,
      ctor,
      getDerivedStateFromProps,
      newProps
    )
    newState = workInProgress.memoizedState
  }

  const shouldUpdate =
    checkHasForceUpdateAfterProcessing() ||
    checkShouldComponentUpdate(
      workInProgress,
      ctor,
      oldProps,
      newProps,
      oldState,
      newState,
      nextContext
    )

  if (shouldUpdate) {
    // In order to support react-lifecycles-compat polyfilled components,
    // Unsafe lifecycles should not be invoked for components using the new APIs.
    if (
      !hasNewLifecycles &&
      (typeof instance.UNSAFE_componentWillMount === "function" ||
        typeof instance.componentWillMount === "function")
    ) {
      startPhaseTimer(workInProgress, "componentWillMount")
      if (typeof instance.componentWillMount === "function") {
        instance.componentWillMount()
      }
      if (typeof instance.UNSAFE_componentWillMount === "function") {
        instance.UNSAFE_componentWillMount()
      }
      stopPhaseTimer()
    }
    if (typeof instance.componentDidMount === "function") {
      workInProgress.effectTag |= Update
    }
  } else {
    // If an update was already in progress, we should schedule an Update
    // effect even though we're bailing out, so that cWU/cDU are called.
    if (typeof instance.componentDidMount === "function") {
      workInProgress.effectTag |= Update
    }

    // If shouldComponentUpdate returned false, we should still update the
    // memoized state to indicate that this work can be reused.
    workInProgress.memoizedProps = newProps
    workInProgress.memoizedState = newState
  }

  // Update the existing instance's state, props, and context pointers even
  // if shouldComponentUpdate returns false.
  instance.props = newProps
  instance.state = newState
  instance.context = nextContext

  return shouldUpdate
}

// Invokes the update life-cycles and returns false if it shouldn't rerender.
function updateClassInstance(
  current: Fiber,
  workInProgress: Fiber,
  ctor: any,
  newProps: any,
  renderExpirationTime: ExpirationTime
): boolean {
  const instance = workInProgress.stateNode

  const oldProps = workInProgress.memoizedProps
  instance.props =
    workInProgress.type === workInProgress.elementType
      ? oldProps
      : resolveDefaultProps(workInProgress.type, oldProps)

  const oldContext = instance.context
  const contextType = ctor.contextType
  let nextContext = emptyContextObject
  if (typeof contextType === "object" && contextType !== null) {
    nextContext = readContext(contextType)
  } else if (!disableLegacyContext) {
    const nextUnmaskedContext = getUnmaskedContext(workInProgress, ctor, true)
    nextContext = getMaskedContext(workInProgress, nextUnmaskedContext)
  }

  const getDerivedStateFromProps = ctor.getDerivedStateFromProps
  const hasNewLifecycles =
    typeof getDerivedStateFromProps === "function" ||
    typeof instance.getSnapshotBeforeUpdate === "function"

  // Note: During these life-cycles, instance.props/instance.state are what
  // ever the previously attempted to render - not the "current". However,
  // during componentDidUpdate we pass the "current" props.

  // In order to support react-lifecycles-compat polyfilled components,
  // Unsafe lifecycles should not be invoked for components using the new APIs.
  if (
    !hasNewLifecycles &&
    (typeof instance.UNSAFE_componentWillReceiveProps === "function" ||
      typeof instance.componentWillReceiveProps === "function")
  ) {
    if (oldProps !== newProps || oldContext !== nextContext) {
      callComponentWillReceiveProps(
        workInProgress,
        instance,
        newProps,
        nextContext
      )
    }
  }

  resetHasForceUpdateBeforeProcessing()

  const oldState = workInProgress.memoizedState
  let newState = (instance.state = oldState)
  let updateQueue = workInProgress.updateQueue
  if (updateQueue !== null) {
    processUpdateQueue(
      workInProgress,
      updateQueue,
      newProps,
      instance,
      renderExpirationTime
    )
    newState = workInProgress.memoizedState
  }

  if (
    oldProps === newProps &&
    oldState === newState &&
    !hasContextChanged() &&
    !checkHasForceUpdateAfterProcessing()
  ) {
    // If an update was already in progress, we should schedule an Update
    // effect even though we're bailing out, so that cWU/cDU are called.
    if (typeof instance.componentDidUpdate === "function") {
      if (
        oldProps !== current.memoizedProps ||
        oldState !== current.memoizedState
      ) {
        workInProgress.effectTag |= Update
      }
    }
    if (typeof instance.getSnapshotBeforeUpdate === "function") {
      if (
        oldProps !== current.memoizedProps ||
        oldState !== current.memoizedState
      ) {
        workInProgress.effectTag |= Snapshot
      }
    }
    return false
  }

  if (typeof getDerivedStateFromProps === "function") {
    applyDerivedStateFromProps(
      workInProgress,
      ctor,
      getDerivedStateFromProps,
      newProps
    )
    newState = workInProgress.memoizedState
  }

  const shouldUpdate =
    checkHasForceUpdateAfterProcessing() ||
    checkShouldComponentUpdate(
      workInProgress,
      ctor,
      oldProps,
      newProps,
      oldState,
      newState,
      nextContext
    )

  if (shouldUpdate) {
    // In order to support react-lifecycles-compat polyfilled components,
    // Unsafe lifecycles should not be invoked for components using the new APIs.
    if (
      !hasNewLifecycles &&
      (typeof instance.UNSAFE_componentWillUpdate === "function" ||
        typeof instance.componentWillUpdate === "function")
    ) {
      startPhaseTimer(workInProgress, "componentWillUpdate")
      if (typeof instance.componentWillUpdate === "function") {
        instance.componentWillUpdate(newProps, newState, nextContext)
      }
      if (typeof instance.UNSAFE_componentWillUpdate === "function") {
        instance.UNSAFE_componentWillUpdate(newProps, newState, nextContext)
      }
      stopPhaseTimer()
    }
    if (typeof instance.componentDidUpdate === "function") {
      workInProgress.effectTag |= Update
    }
    if (typeof instance.getSnapshotBeforeUpdate === "function") {
      workInProgress.effectTag |= Snapshot
    }
  } else {
    // If an update was already in progress, we should schedule an Update
    // effect even though we're bailing out, so that cWU/cDU are called.
    if (typeof instance.componentDidUpdate === "function") {
      if (
        oldProps !== current.memoizedProps ||
        oldState !== current.memoizedState
      ) {
        workInProgress.effectTag |= Update
      }
    }
    if (typeof instance.getSnapshotBeforeUpdate === "function") {
      if (
        oldProps !== current.memoizedProps ||
        oldState !== current.memoizedState
      ) {
        workInProgress.effectTag |= Snapshot
      }
    }

    // If shouldComponentUpdate returned false, we should still update the
    // memoized props/state to indicate that this work can be reused.
    workInProgress.memoizedProps = newProps
    workInProgress.memoizedState = newState
  }

  // Update the existing instance's state, props, and context pointers even
  // if shouldComponentUpdate returns false.
  instance.props = newProps
  instance.state = newState
  instance.context = nextContext

  return shouldUpdate
}

export {
  adoptClassInstance,
  constructClassInstance,
  mountClassInstance,
  resumeMountClassInstance,
  updateClassInstance
}
