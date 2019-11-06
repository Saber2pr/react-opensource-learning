/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 * @flow
 */

import invariant from "shared/invariant"

import {
  injectEventPluginOrder,
  injectEventPluginsByName,
  plugins
} from "./EventPluginRegistry"
import { getFiberCurrentPropsFromNode } from "./EventPluginUtils"
import accumulateInto from "./accumulateInto"
import { runEventsInBatch } from "./EventBatching"

import type { PluginModule } from "./PluginModuleType"
import type { ReactSyntheticEvent } from "./ReactSyntheticEventType"
import type { Fiber } from "react-reconciler/src/ReactFiber"
import type { AnyNativeEvent } from "./PluginModuleType"
import type { TopLevelType } from "./TopLevelEventTypes"

function isInteractive(tag) {
  return (
    tag === "button" ||
    tag === "input" ||
    tag === "select" ||
    tag === "textarea"
  )
}

function shouldPreventMouseEvent(name, type, props) {
  switch (name) {
    case "onClick":
    case "onClickCapture":
    case "onDoubleClick":
    case "onDoubleClickCapture":
    case "onMouseDown":
    case "onMouseDownCapture":
    case "onMouseMove":
    case "onMouseMoveCapture":
    case "onMouseUp":
    case "onMouseUpCapture":
      return !!(props.disabled && isInteractive(type))
    default:
      return false
  }
}

export const injection = {
  injectEventPluginOrder,
  injectEventPluginsByName
}

export function getListener(inst: Fiber, registrationName: string) {
  let listener

  const stateNode = inst.stateNode
  if (!stateNode) return null

  const props = getFiberCurrentPropsFromNode(stateNode)
  if (!props) return null

  listener = props[registrationName]
  if (shouldPreventMouseEvent(registrationName, inst.type, props)) {
    return null
  }

  return listener
}

function extractPluginEvents(
  topLevelType: TopLevelType,
  targetInst: null | Fiber,
  nativeEvent: AnyNativeEvent,
  nativeEventTarget: EventTarget
): Array<ReactSyntheticEvent> | ReactSyntheticEvent | null {
  let events = null
  for (let i = 0; i < plugins.length; i++) {
    const possiblePlugin: PluginModule<AnyNativeEvent> = plugins[i]
    if (possiblePlugin) {
      const extractedEvents = possiblePlugin.extractEvents(
        topLevelType,
        targetInst,
        nativeEvent,
        nativeEventTarget
      )
      if (extractedEvents) {
        events = accumulateInto(events, extractedEvents)
      }
    }
  }
  return events
}

export function runExtractedPluginEventsInBatch(
  topLevelType: TopLevelType,
  targetInst: null | Fiber,
  nativeEvent: AnyNativeEvent,
  nativeEventTarget: EventTarget
) {
  const events = extractPluginEvents(
    topLevelType,
    targetInst,
    nativeEvent,
    nativeEventTarget
  )
  runEventsInBatch(events)
}
