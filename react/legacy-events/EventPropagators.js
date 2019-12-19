/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// 用于收集Fiber实例在捕获、冒泡整个链条中的所有节点。

import {
  getParentInstance,
  traverseTwoPhase,
  traverseEnterLeave
} from "shared/ReactTreeTraversal"
import warningWithoutStack from "shared/warningWithoutStack"

import { getListener } from "./EventPluginHub"
import accumulateInto from "./accumulateInto"
import forEachAccumulated from "./forEachAccumulated"

type PropagationPhases = "bubbled" | "captured"

function listenerAtPhase(inst, event, propagationPhase: PropagationPhases) {
  const registrationName =
    event.dispatchConfig.phasedRegistrationNames[propagationPhase]
  return getListener(inst, registrationName)
}

function accumulateDirectionalDispatches(inst, phase, event) {
  const listener = listenerAtPhase(inst, event, phase)
  if (listener) {
    event._dispatchListeners = accumulateInto(
      event._dispatchListeners,
      listener
    )
    event._dispatchInstances = accumulateInto(event._dispatchInstances, inst)
  }
}

function accumulateTwoPhaseDispatchesSingle(event) {
  if (event && event.dispatchConfig.phasedRegistrationNames) {
    traverseTwoPhase(event._targetInst, accumulateDirectionalDispatches, event)
  }
}

/**
 * Same as `accumulateTwoPhaseDispatchesSingle`, but skips over the targetID.
 */
function accumulateTwoPhaseDispatchesSingleSkipTarget(event) {
  if (event && event.dispatchConfig.phasedRegistrationNames) {
    const targetInst = event._targetInst
    const parentInst = targetInst ? getParentInstance(targetInst) : null
    traverseTwoPhase(parentInst, accumulateDirectionalDispatches, event)
  }
}

function accumulateDispatches(inst, ignoredDirection, event) {
  if (inst && event && event.dispatchConfig.registrationName) {
    const registrationName = event.dispatchConfig.registrationName
    const listener = getListener(inst, registrationName)
    if (listener) {
      event._dispatchListeners = accumulateInto(
        event._dispatchListeners,
        listener
      )
      event._dispatchInstances = accumulateInto(event._dispatchInstances, inst)
    }
  }
}

function accumulateDirectDispatchesSingle(event) {
  if (event && event.dispatchConfig.registrationName) {
    accumulateDispatches(event._targetInst, null, event)
  }
}

export function accumulateTwoPhaseDispatches(events) {
  forEachAccumulated(events, accumulateTwoPhaseDispatchesSingle)
}

export function accumulateTwoPhaseDispatchesSkipTarget(events) {
  forEachAccumulated(events, accumulateTwoPhaseDispatchesSingleSkipTarget)
}

export function accumulateEnterLeaveDispatches(leave, enter, from, to) {
  traverseEnterLeave(from, to, accumulateDispatches, leave, enter)
}

export function accumulateDirectDispatches(events) {
  forEachAccumulated(events, accumulateDirectDispatchesSingle)
}
