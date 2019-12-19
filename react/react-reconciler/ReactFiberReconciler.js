/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type { Fiber } from "./ReactFiber"
import type { FiberRoot } from "./ReactFiberRoot"
import type { RootTag } from "shared/ReactRootTags"
import type {
  Instance,
  TextInstance,
  Container,
  PublicInstance
} from "./ReactFiberHostConfig"
import { FundamentalComponent } from "shared/ReactWorkTags"
import type { ReactNodeList } from "shared/ReactTypes"
import type { ExpirationTime } from "./ReactFiberExpirationTime"
import type { SuspenseConfig } from "./ReactFiberSuspenseConfig"

import {
  findCurrentHostFiber,
  findCurrentHostFiberWithNoPortals
} from "react-reconciler/reflection"
import { get as getInstance } from "../shared/ReactInstanceMap"
import { HostComponent, ClassComponent } from "shared/ReactWorkTags"
import getComponentName from "shared/getComponentName"
import invariant from "shared/invariant"
import warningWithoutStack from "shared/warningWithoutStack"
import ReactSharedInternals from "shared/ReactSharedInternals"

import { getPublicInstance } from "./ReactFiberHostConfig"
import {
  findCurrentUnmaskedContext,
  processChildContext,
  emptyContextObject,
  isContextProvider as isLegacyContextProvider
} from "./ReactFiberContext"
import { createFiberRoot } from "./ReactFiberRoot"
import { injectInternals } from "./ReactFiberDevToolsHook"
import {
  computeUniqueAsyncExpiration,
  requestCurrentTime,
  computeExpirationForFiber,
  scheduleWork,
  flushRoot,
  batchedEventUpdates,
  batchedUpdates,
  unbatchedUpdates,
  flushSync,
  flushControlled,
  deferredUpdates,
  syncUpdates,
  discreteUpdates,
  flushDiscreteUpdates,
  flushPassiveEffects,
  warnIfNotScopedWithMatchingAct,
  warnIfUnmockedScheduler,
  IsThisRendererActing
} from "./ReactFiberWorkLoop"
import { createUpdate, enqueueUpdate } from "./ReactUpdateQueue"
import ReactFiberInstrumentation from "./ReactFiberInstrumentation"
import {
  getStackByFiberInDevAndProd,
  phase as ReactCurrentFiberPhase,
  current as ReactCurrentFiberCurrent
} from "./ReactCurrentFiber"
import { StrictMode } from "./ReactTypeOfMode"
import { Sync } from "./ReactFiberExpirationTime"
import { requestCurrentSuspenseConfig } from "./ReactFiberSuspenseConfig"
import {
  scheduleRefresh,
  scheduleRoot,
  setRefreshHandler,
  findHostInstancesForRefresh
} from "./ReactFiberHotReloading"

type OpaqueRoot = FiberRoot

// 0 is PROD, 1 is DEV.
// Might add PROFILE later.
type BundleType = 0 | 1

type DevToolsConfig = {|
  bundleType: BundleType,
  version: string,
  rendererPackageName: string,
  // Note: this actually *does* depend on Fiber internal fields.
  // Used by "inspect clicked DOM element" in React DevTools.
  findFiberByHostInstance?: (instance: Instance | TextInstance) => Fiber,
  // Used by RN in-app inspector.
  // This API is unfortunately RN-specific.
  // TODO: Change it to accept Fiber instead and type it properly.
  getInspectorDataForViewTag?: (tag: number) => Object
|}

let didWarnAboutNestedUpdates
let didWarnAboutFindNodeInStrictMode

function getContextForSubtree(
  parentComponent: ?React$Component<any, any>
): Object {
  if (!parentComponent) {
    return emptyContextObject
  }

  const fiber = getInstance(parentComponent)
  const parentContext = findCurrentUnmaskedContext(fiber)

  if (fiber.tag === ClassComponent) {
    const Component = fiber.type
    if (isLegacyContextProvider(Component)) {
      return processChildContext(fiber, Component, parentContext)
    }
  }

  return parentContext
}

function scheduleRootUpdate(
  current: Fiber,
  element: ReactNodeList,
  expirationTime: ExpirationTime,
  suspenseConfig: null | SuspenseConfig,
  callback: ?Function
) {
  const update = createUpdate(expirationTime, suspenseConfig)
  // Caution: React DevTools currently depends on this property
  // being called "element".
  update.payload = { element }

  callback = callback === undefined ? null : callback
  if (callback !== null) {
    warningWithoutStack(
      typeof callback === "function",
      "render(...): Expected the last optional `callback` argument to be a " +
        "function. Instead received: %s.",
      callback
    )
    update.callback = callback
  }

  enqueueUpdate(current, update)
  scheduleWork(current, expirationTime)

  return expirationTime
}

export function updateContainerAtExpirationTime(
  element: ReactNodeList,
  container: OpaqueRoot,
  parentComponent: ?React$Component<any, any>,
  expirationTime: ExpirationTime,
  suspenseConfig: null | SuspenseConfig,
  callback: ?Function
) {
  // TODO: If this is a nested container, this won't be the root.
  const current = container.current

  const context = getContextForSubtree(parentComponent)
  if (container.context === null) {
    container.context = context
  } else {
    container.pendingContext = context
  }

  return scheduleRootUpdate(
    current,
    element,
    expirationTime,
    suspenseConfig,
    callback
  )
}

function findHostInstance(component: Object): PublicInstance | null {
  const fiber = getInstance(component)
  const hostFiber = findCurrentHostFiber(fiber)
  if (hostFiber === null) return null
  return hostFiber.stateNode
}

function findHostInstanceWithWarning(
  component: Object,
  methodName: string
): PublicInstance | null {
  return findHostInstance(component)
}

export function createContainer(
  containerInfo: Container,
  tag: RootTag,
  hydrate: boolean
): OpaqueRoot {
  return createFiberRoot(containerInfo, tag, hydrate)
}
// entry
export function updateContainer(
  element: ReactNodeList,
  container: OpaqueRoot,
  parentComponent: ?React$Component<any, any>,
  callback: ?Function
): ExpirationTime {
  const current = container.current
  const currentTime = requestCurrentTime()

  const suspenseConfig = requestCurrentSuspenseConfig()
  const expirationTime = computeExpirationForFiber(
    currentTime,
    current,
    suspenseConfig
  )

  return updateContainerAtExpirationTime(
    element,
    container,
    parentComponent,
    expirationTime,
    suspenseConfig,
    callback
  )
}

export {
  flushRoot,
  computeUniqueAsyncExpiration,
  batchedEventUpdates,
  batchedUpdates,
  unbatchedUpdates,
  deferredUpdates,
  syncUpdates,
  discreteUpdates,
  flushDiscreteUpdates,
  flushControlled,
  flushSync,
  flushPassiveEffects,
  IsThisRendererActing
}

export function getPublicRootInstance(
  container: OpaqueRoot
): React$Component<any, any> | PublicInstance | null {
  const containerFiber = container.current
  if (!containerFiber.child) {
    return null
  }
  switch (containerFiber.child.tag) {
    case HostComponent:
      return getPublicInstance(containerFiber.child.stateNode)
    default:
      return containerFiber.child.stateNode
  }
}

export { findHostInstance }

export { findHostInstanceWithWarning }

export function findHostInstanceWithNoPortals(
  fiber: Fiber
): PublicInstance | null {
  const hostFiber = findCurrentHostFiberWithNoPortals(fiber)
  if (hostFiber === null) {
    return null
  }
  if (hostFiber.tag === FundamentalComponent) {
    return hostFiber.stateNode.instance
  }
  return hostFiber.stateNode
}

let shouldSuspendImpl = fiber => false

export function shouldSuspend(fiber: Fiber): boolean {
  return shouldSuspendImpl(fiber)
}

let overrideHookState = null
let overrideProps = null
let scheduleUpdate = null
let setSuspenseHandler = null

export function injectIntoDevTools(devToolsConfig: DevToolsConfig): boolean {
  const { findFiberByHostInstance } = devToolsConfig
  const { ReactCurrentDispatcher } = ReactSharedInternals

  return injectInternals({
    ...devToolsConfig,
    overrideHookState,
    overrideProps,
    setSuspenseHandler,
    scheduleUpdate,
    currentDispatcherRef: ReactCurrentDispatcher,
    findHostInstanceByFiber(fiber: Fiber): Instance | TextInstance | null {
      const hostFiber = findCurrentHostFiber(fiber)
      if (hostFiber === null) {
        return null
      }
      return hostFiber.stateNode
    },
    findFiberByHostInstance(instance: Instance | TextInstance): Fiber | null {
      if (!findFiberByHostInstance) {
        // Might not be implemented by the renderer.
        return null
      }
      return findFiberByHostInstance(instance)
    },
    // React Refresh
    findHostInstancesForRefresh: __DEV__ ? findHostInstancesForRefresh : null,
    scheduleRefresh: __DEV__ ? scheduleRefresh : null,
    scheduleRoot: __DEV__ ? scheduleRoot : null,
    setRefreshHandler: __DEV__ ? setRefreshHandler : null,
    // Enables DevTools to append owner stacks to error messages in DEV mode.
    getCurrentFiber: __DEV__ ? () => ReactCurrentFiberCurrent : null
  })
}
