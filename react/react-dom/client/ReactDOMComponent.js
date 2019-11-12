/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

// TODO: direct imports like some-package/src/* are bad. Fix me.
import { getCurrentFiberOwnerNameInDevOrNull } from "react-reconciler/src/ReactCurrentFiber"
import { registrationNameModules } from "legacy-events/EventPluginRegistry"
import warning from "shared/warning"
import { canUseDOM } from "shared/ExecutionEnvironment"
import warningWithoutStack from "shared/warningWithoutStack"
import endsWith from "shared/endsWith"
import type { DOMTopLevelEventType } from "legacy-events/TopLevelEventTypes"
import { setListenToResponderEventTypes } from "../events/DOMEventResponderSystem"

import {
  getValueForAttribute,
  getValueForProperty,
  setValueForProperty
} from "./DOMPropertyOperations"
import {
  initWrapperState as ReactDOMInputInitWrapperState,
  getHostProps as ReactDOMInputGetHostProps,
  postMountWrapper as ReactDOMInputPostMountWrapper,
  updateChecked as ReactDOMInputUpdateChecked,
  updateWrapper as ReactDOMInputUpdateWrapper,
  restoreControlledState as ReactDOMInputRestoreControlledState
} from "./ReactDOMInput"
import {
  getHostProps as ReactDOMOptionGetHostProps,
  postMountWrapper as ReactDOMOptionPostMountWrapper,
  validateProps as ReactDOMOptionValidateProps
} from "./ReactDOMOption"
import {
  initWrapperState as ReactDOMSelectInitWrapperState,
  getHostProps as ReactDOMSelectGetHostProps,
  postMountWrapper as ReactDOMSelectPostMountWrapper,
  restoreControlledState as ReactDOMSelectRestoreControlledState,
  postUpdateWrapper as ReactDOMSelectPostUpdateWrapper
} from "./ReactDOMSelect"
import {
  initWrapperState as ReactDOMTextareaInitWrapperState,
  getHostProps as ReactDOMTextareaGetHostProps,
  postMountWrapper as ReactDOMTextareaPostMountWrapper,
  updateWrapper as ReactDOMTextareaUpdateWrapper,
  restoreControlledState as ReactDOMTextareaRestoreControlledState
} from "./ReactDOMTextarea"
import { track } from "./inputValueTracking"
import setInnerHTML from "./setInnerHTML"
import setTextContent from "./setTextContent"
import {
  TOP_ERROR,
  TOP_INVALID,
  TOP_LOAD,
  TOP_RESET,
  TOP_SUBMIT,
  TOP_TOGGLE
} from "../events/DOMTopLevelEventTypes"
import {
  listenTo,
  trapBubbledEvent,
  getListeningSetForElement
} from "../events/ReactBrowserEventEmitter"
import { trapEventForResponderEventSystem } from "../events/ReactDOMEventListener.js"
import { mediaEventTypes } from "../events/DOMTopLevelEventTypes"
import {
  createDangerousStringForStyles,
  setValueForStyles,
  validateShorthandPropertyCollisionInDev
} from "../shared/CSSPropertyOperations"
import { Namespaces, getIntrinsicNamespace } from "../shared/DOMNamespaces"
import {
  getPropertyInfo,
  shouldIgnoreAttribute,
  shouldRemoveAttribute
} from "../shared/DOMProperty"
import assertValidProps from "../shared/assertValidProps"
import { DOCUMENT_NODE, DOCUMENT_FRAGMENT_NODE } from "../shared/HTMLNodeType"
import isCustomComponent from "../shared/isCustomComponent"
import possibleStandardNames from "../shared/possibleStandardNames"
import { validateProperties as validateARIAProperties } from "../shared/ReactDOMInvalidARIAHook"
import { validateProperties as validateInputProperties } from "../shared/ReactDOMNullInputValuePropHook"
import { validateProperties as validateUnknownProperties } from "../shared/ReactDOMUnknownPropertyHook"

import { enableFlareAPI } from "shared/ReactFeatureFlags"

let didWarnInvalidHydration = false
let didWarnShadyDOM = false

const DANGEROUSLY_SET_INNER_HTML = "dangerouslySetInnerHTML"
const SUPPRESS_CONTENT_EDITABLE_WARNING = "suppressContentEditableWarning"
const SUPPRESS_HYDRATION_WARNING = "suppressHydrationWarning"
const AUTOFOCUS = "autoFocus"
const CHILDREN = "children"
const STYLE = "style"
const HTML = "__html"
const LISTENERS = "listeners"

const { html: HTML_NAMESPACE } = Namespaces

let warnedUnknownTags
let suppressHydrationWarning

let validatePropertiesInDevelopment
let warnForTextDifference
let warnForPropDifference
let warnForExtraAttributes
let warnForInvalidEventListener
let canDiffStyleForHydrationWarning

let normalizeMarkupForTextOrAttribute
let normalizeHTML

if (__DEV__) {
  warnedUnknownTags = {
    // Chrome is the only major browser not shipping <time>. But as of July
    // 2017 it intends to ship it due to widespread usage. We intentionally
    // *don't* warn for <time> even if it's unrecognized by Chrome because
    // it soon will be, and many apps have been using it anyway.
    time: true,
    // There are working polyfills for <dialog>. Let people use it.
    dialog: true,
    // Electron ships a custom <webview> tag to display external web content in
    // an isolated frame and process.
    // This tag is not present in non Electron environments such as JSDom which
    // is often used for testing purposes.
    // @see https://electronjs.org/docs/api/webview-tag
    webview: true
  }

  validatePropertiesInDevelopment = function(type, props) {
    validateARIAProperties(type, props)
    validateInputProperties(type, props)
    validateUnknownProperties(type, props, /* canUseEventSystem */ true)
  }

  // IE 11 parses & normalizes the style attribute as opposed to other
  // browsers. It adds spaces and sorts the properties in some
  // non-alphabetical order. Handling that would require sorting CSS
  // properties in the client & server versions or applying
  // `expectedStyle` to a temporary DOM node to read its `style` attribute
  // normalized. Since it only affects IE, we're skipping style warnings
  // in that browser completely in favor of doing all that work.
  // See https://github.com/facebook/react/issues/11807
  canDiffStyleForHydrationWarning = canUseDOM && !document.documentMode

  // HTML parsing normalizes CR and CRLF to LF.
  // It also can turn \u0000 into \uFFFD inside attributes.
  // https://www.w3.org/TR/html5/single-page.html#preprocessing-the-input-stream
  // If we have a mismatch, it might be caused by that.
  // We will still patch up in this case but not fire the warning.
  const NORMALIZE_NEWLINES_REGEX = /\r\n?/g
  const NORMALIZE_NULL_AND_REPLACEMENT_REGEX = /\u0000|\uFFFD/g

  normalizeMarkupForTextOrAttribute = function(markup: mixed): string {
    const markupString =
      typeof markup === "string" ? markup : "" + (markup: any)
    return markupString
      .replace(NORMALIZE_NEWLINES_REGEX, "\n")
      .replace(NORMALIZE_NULL_AND_REPLACEMENT_REGEX, "")
  }

  warnForTextDifference = function(
    serverText: string,
    clientText: string | number
  ) {
    if (didWarnInvalidHydration) {
      return
    }
    const normalizedClientText = normalizeMarkupForTextOrAttribute(clientText)
    const normalizedServerText = normalizeMarkupForTextOrAttribute(serverText)
    if (normalizedServerText === normalizedClientText) {
      return
    }
    didWarnInvalidHydration = true
    warningWithoutStack(
      false,
      'Text content did not match. Server: "%s" Client: "%s"',
      normalizedServerText,
      normalizedClientText
    )
  }

  warnForPropDifference = function(
    propName: string,
    serverValue: mixed,
    clientValue: mixed
  ) {
    if (didWarnInvalidHydration) {
      return
    }
    const normalizedClientValue = normalizeMarkupForTextOrAttribute(clientValue)
    const normalizedServerValue = normalizeMarkupForTextOrAttribute(serverValue)
    if (normalizedServerValue === normalizedClientValue) {
      return
    }
    didWarnInvalidHydration = true
    warningWithoutStack(
      false,
      "Prop `%s` did not match. Server: %s Client: %s",
      propName,
      JSON.stringify(normalizedServerValue),
      JSON.stringify(normalizedClientValue)
    )
  }

  warnForExtraAttributes = function(attributeNames: Set<string>) {
    if (didWarnInvalidHydration) {
      return
    }
    didWarnInvalidHydration = true
    const names = []
    attributeNames.forEach(function(name) {
      names.push(name)
    })
    warningWithoutStack(false, "Extra attributes from the server: %s", names)
  }

  warnForInvalidEventListener = function(registrationName, listener) {
    if (listener === false) {
      warning(
        false,
        "Expected `%s` listener to be a function, instead got `false`.\n\n" +
          "If you used to conditionally omit it with %s={condition && value}, " +
          "pass %s={condition ? value : undefined} instead.",
        registrationName,
        registrationName,
        registrationName
      )
    } else {
      warning(
        false,
        "Expected `%s` listener to be a function, instead got a value of `%s` type.",
        registrationName,
        typeof listener
      )
    }
  }

  // Parse the HTML and read it back to normalize the HTML string so that it
  // can be used for comparison.
  normalizeHTML = function(parent: Element, html: string) {
    // We could have created a separate document here to avoid
    // re-initializing custom elements if they exist. But this breaks
    // how <noscript> is being handled. So we use the same document.
    // See the discussion in https://github.com/facebook/react/pull/11157.
    const testElement =
      parent.namespaceURI === HTML_NAMESPACE
        ? parent.ownerDocument.createElement(parent.tagName)
        : parent.ownerDocument.createElementNS(
            (parent.namespaceURI: any),
            parent.tagName
          )
    testElement.innerHTML = html
    return testElement.innerHTML
  }
}

function ensureListeningTo(
  rootContainerElement: Element | Node,
  registrationName: string
): void {
  const isDocumentOrFragment =
    rootContainerElement.nodeType === DOCUMENT_NODE ||
    rootContainerElement.nodeType === DOCUMENT_FRAGMENT_NODE
  const doc = isDocumentOrFragment
    ? rootContainerElement
    : rootContainerElement.ownerDocument
  listenTo(registrationName, doc)
}

function getOwnerDocumentFromRootContainer(
  rootContainerElement: Element | Document
): Document {
  return rootContainerElement.nodeType === DOCUMENT_NODE
    ? (rootContainerElement: any)
    : rootContainerElement.ownerDocument
}

function noop() {}

export function trapClickOnNonInteractiveElement(node: HTMLElement) {
  // Mobile Safari does not fire properly bubble click events on
  // non-interactive elements, which means delegated click listeners do not
  // fire. The workaround for this bug involves attaching an empty click
  // listener on the target node.
  // http://www.quirksmode.org/blog/archives/2010/09/click_event_del.html
  // Just set it using the onclick property so that we don't have to manage any
  // bookkeeping for it. Not sure if we need to clear it when the listener is
  // removed.
  // TODO: Only do this for the relevant Safaris maybe?
  node.onclick = noop
}

function setInitialDOMProperties(
  tag: string,
  domElement: Element,
  rootContainerElement: Element | Document,
  nextProps: Object,
  isCustomComponentTag: boolean
): void {
  for (const propKey in nextProps) {
    if (!nextProps.hasOwnProperty(propKey)) {
      continue
    }
    const nextProp = nextProps[propKey]
    if (propKey === STYLE) {
      if (__DEV__) {
        if (nextProp) {
          // Freeze the next style object so that we can assume it won't be
          // mutated. We have already warned for this in the past.
          Object.freeze(nextProp)
        }
      }
      // Relies on `updateStylesByID` not mutating `styleUpdates`.
      setValueForStyles(domElement, nextProp)
    } else if (propKey === DANGEROUSLY_SET_INNER_HTML) {
      const nextHtml = nextProp ? nextProp[HTML] : undefined
      if (nextHtml != null) {
        setInnerHTML(domElement, nextHtml)
      }
    } else if (propKey === CHILDREN) {
      if (typeof nextProp === "string") {
        // Avoid setting initial textContent when the text is empty. In IE11 setting
        // textContent on a <textarea> will cause the placeholder to not
        // show within the <textarea> until it has been focused and blurred again.
        // https://github.com/facebook/react/issues/6731#issuecomment-254874553
        const canSetTextContent = tag !== "textarea" || nextProp !== ""
        if (canSetTextContent) {
          setTextContent(domElement, nextProp)
        }
      } else if (typeof nextProp === "number") {
        setTextContent(domElement, "" + nextProp)
      }
    } else if (
      (enableFlareAPI && propKey === LISTENERS) ||
      propKey === SUPPRESS_CONTENT_EDITABLE_WARNING ||
      propKey === SUPPRESS_HYDRATION_WARNING
    ) {
      // Noop
    } else if (propKey === AUTOFOCUS) {
      // We polyfill it separately on the client during commit.
      // We could have excluded it in the property list instead of
      // adding a special case here, but then it wouldn't be emitted
      // on server rendering (but we *do* want to emit it in SSR).
    } else if (registrationNameModules.hasOwnProperty(propKey)) {
      if (nextProp != null) {
        if (__DEV__ && typeof nextProp !== "function") {
          warnForInvalidEventListener(propKey, nextProp)
        }
        ensureListeningTo(rootContainerElement, propKey)
      }
    } else if (nextProp != null) {
      setValueForProperty(domElement, propKey, nextProp, isCustomComponentTag)
    }
  }
}

function updateDOMProperties(
  domElement: Element,
  updatePayload: Array<any>,
  wasCustomComponentTag: boolean,
  isCustomComponentTag: boolean
): void {
  // TODO: Handle wasCustomComponentTag
  for (let i = 0; i < updatePayload.length; i += 2) {
    const propKey = updatePayload[i]
    const propValue = updatePayload[i + 1]
    if (propKey === STYLE) {
      setValueForStyles(domElement, propValue)
    } else if (propKey === DANGEROUSLY_SET_INNER_HTML) {
      setInnerHTML(domElement, propValue)
    } else if (propKey === CHILDREN) {
      setTextContent(domElement, propValue)
    } else {
      setValueForProperty(domElement, propKey, propValue, isCustomComponentTag)
    }
  }
}

export function createElement(
  type: string,
  props: Object,
  rootContainerElement: Element | Document,
  parentNamespace: string
): Element {
  let isCustomComponentTag

  const ownerDocument: Document = getOwnerDocumentFromRootContainer(
    rootContainerElement
  )
  let domElement: Element
  let namespaceURI = parentNamespace
  if (namespaceURI === HTML_NAMESPACE) {
    namespaceURI = getIntrinsicNamespace(type)
  }
  if (namespaceURI === HTML_NAMESPACE) {
    if (type === "script") {
      // 通过innerHTML生成script标签，不会执行
      const div = ownerDocument.createElement("div")
      div.innerHTML = "<script><" + "/script>"
      const firstChild = ((div.firstChild: any): HTMLScriptElement)
      domElement = div.removeChild(firstChild)
    } else if (typeof props.is === "string") {
      domElement = ownerDocument.createElement(type, { is: props.is })
    } else {
      domElement = ownerDocument.createElement(type)
      if (type === "select") {
        const node: HTMLSelectElement = domElement
        if (props.multiple) {
          node.multiple = true
        } else if (props.size) {
          node.size = props.size
        }
      }
    }
  } else {
    domElement = ownerDocument.createElementNS(namespaceURI, type)
  }

  return domElement
}

export function createTextNode(
  text: string,
  rootContainerElement: Element | Document
): Text {
  return getOwnerDocumentFromRootContainer(rootContainerElement).createTextNode(
    text
  )
}

export function setInitialProperties(
  domElement: Element,
  tag: string,
  rawProps: Object,
  rootContainerElement: Element | Document
): void {
  const isCustomComponentTag = isCustomComponent(tag, rawProps)
  let props: Object
  switch (tag) {
    case "iframe":
    case "object":
    case "embed":
      trapBubbledEvent(TOP_LOAD, domElement)
      props = rawProps
      break
    case "video":
    case "audio":
      for (let i = 0; i < mediaEventTypes.length; i++) {
        trapBubbledEvent(mediaEventTypes[i], domElement)
      }
      props = rawProps
      break
    case "source":
      trapBubbledEvent(TOP_ERROR, domElement)
      props = rawProps
      break
    case "img":
    case "image":
    case "link":
      trapBubbledEvent(TOP_ERROR, domElement)
      trapBubbledEvent(TOP_LOAD, domElement)
      props = rawProps
      break
    case "form":
      trapBubbledEvent(TOP_RESET, domElement)
      trapBubbledEvent(TOP_SUBMIT, domElement)
      props = rawProps
      break
    case "details":
      trapBubbledEvent(TOP_TOGGLE, domElement)
      props = rawProps
      break
    case "input":
      ReactDOMInputInitWrapperState(domElement, rawProps)
      props = ReactDOMInputGetHostProps(domElement, rawProps)
      trapBubbledEvent(TOP_INVALID, domElement)
      ensureListeningTo(rootContainerElement, "onChange")
      break
    case "option":
      ReactDOMOptionValidateProps(domElement, rawProps)
      props = ReactDOMOptionGetHostProps(domElement, rawProps)
      break
    case "select":
      ReactDOMSelectInitWrapperState(domElement, rawProps)
      props = ReactDOMSelectGetHostProps(domElement, rawProps)
      trapBubbledEvent(TOP_INVALID, domElement)
      ensureListeningTo(rootContainerElement, "onChange")
      break
    case "textarea":
      ReactDOMTextareaInitWrapperState(domElement, rawProps)
      props = ReactDOMTextareaGetHostProps(domElement, rawProps)
      trapBubbledEvent(TOP_INVALID, domElement)
      ensureListeningTo(rootContainerElement, "onChange")
      break
    default:
      props = rawProps
  }

  assertValidProps(tag, props)

  setInitialDOMProperties(
    tag,
    domElement,
    rootContainerElement,
    props,
    isCustomComponentTag
  )

  switch (tag) {
    case "input":
      track((domElement: any))
      ReactDOMInputPostMountWrapper(domElement, rawProps, false)
      break
    case "textarea":
      track((domElement: any))
      ReactDOMTextareaPostMountWrapper(domElement, rawProps)
      break
    case "option":
      ReactDOMOptionPostMountWrapper(domElement, rawProps)
      break
    case "select":
      ReactDOMSelectPostMountWrapper(domElement, rawProps)
      break
    default:
      if (typeof props.onClick === "function") {
        trapClickOnNonInteractiveElement(((domElement: any): HTMLElement))
      }
      break
  }
}

export function diffProperties(
  domElement: Element,
  tag: string,
  lastRawProps: Object,
  nextRawProps: Object,
  rootContainerElement: Element | Document
): null | Array<mixed> {
  let updatePayload: null | Array<any> = null

  let lastProps: Object
  let nextProps: Object
  switch (tag) {
    case "input":
      lastProps = ReactDOMInputGetHostProps(domElement, lastRawProps)
      nextProps = ReactDOMInputGetHostProps(domElement, nextRawProps)
      updatePayload = []
      break
    case "option":
      lastProps = ReactDOMOptionGetHostProps(domElement, lastRawProps)
      nextProps = ReactDOMOptionGetHostProps(domElement, nextRawProps)
      updatePayload = []
      break
    case "select":
      lastProps = ReactDOMSelectGetHostProps(domElement, lastRawProps)
      nextProps = ReactDOMSelectGetHostProps(domElement, nextRawProps)
      updatePayload = []
      break
    case "textarea":
      lastProps = ReactDOMTextareaGetHostProps(domElement, lastRawProps)
      nextProps = ReactDOMTextareaGetHostProps(domElement, nextRawProps)
      updatePayload = []
      break
    default:
      lastProps = lastRawProps
      nextProps = nextRawProps
      if (
        typeof lastProps.onClick !== "function" &&
        typeof nextProps.onClick === "function"
      ) {
        trapClickOnNonInteractiveElement(((domElement: any): HTMLElement))
      }
      break
  }

  assertValidProps(tag, nextProps)

  let propKey
  let styleName
  let styleUpdates = null
  for (propKey in lastProps) {
    if (
      nextProps.hasOwnProperty(propKey) ||
      !lastProps.hasOwnProperty(propKey) ||
      lastProps[propKey] == null
    ) {
      continue
    }
    if (propKey === STYLE) {
      const lastStyle = lastProps[propKey]
      for (styleName in lastStyle) {
        if (lastStyle.hasOwnProperty(styleName)) {
          if (!styleUpdates) {
            styleUpdates = {}
          }
          styleUpdates[styleName] = ""
        }
      }
    } else if (propKey === DANGEROUSLY_SET_INNER_HTML || propKey === CHILDREN) {
    } else if (
      (enableFlareAPI && propKey === LISTENERS) ||
      propKey === SUPPRESS_CONTENT_EDITABLE_WARNING ||
      propKey === SUPPRESS_HYDRATION_WARNING
    ) {
      // Noop
    } else if (propKey === AUTOFOCUS) {
    } else if (registrationNameModules.hasOwnProperty(propKey)) {
      if (!updatePayload) {
        updatePayload = []
      }
    } else {
      // For all other deleted properties we add it to the queue. We use
      // the whitelist in the commit phase instead.
      ;(updatePayload = updatePayload || []).push(propKey, null)
    }
  }
  for (propKey in nextProps) {
    const nextProp = nextProps[propKey]
    const lastProp = lastProps != null ? lastProps[propKey] : undefined
    if (
      !nextProps.hasOwnProperty(propKey) ||
      nextProp === lastProp ||
      (nextProp == null && lastProp == null)
    ) {
      continue
    }
    if (propKey === STYLE) {
      if (lastProp) {
        for (styleName in lastProp) {
          if (
            lastProp.hasOwnProperty(styleName) &&
            (!nextProp || !nextProp.hasOwnProperty(styleName))
          ) {
            if (!styleUpdates) {
              styleUpdates = {}
            }
            styleUpdates[styleName] = ""
          }
        }
        for (styleName in nextProp) {
          if (
            nextProp.hasOwnProperty(styleName) &&
            lastProp[styleName] !== nextProp[styleName]
          ) {
            if (!styleUpdates) {
              styleUpdates = {}
            }
            styleUpdates[styleName] = nextProp[styleName]
          }
        }
      } else {
        if (!styleUpdates) {
          if (!updatePayload) {
            updatePayload = []
          }
          updatePayload.push(propKey, styleUpdates)
        }
        styleUpdates = nextProp
      }
    } else if (propKey === DANGEROUSLY_SET_INNER_HTML) {
      const nextHtml = nextProp ? nextProp[HTML] : undefined
      const lastHtml = lastProp ? lastProp[HTML] : undefined
      if (nextHtml != null) {
        if (lastHtml !== nextHtml) {
          ;(updatePayload = updatePayload || []).push(propKey, "" + nextHtml)
        }
      } else {
        // TODO: It might be too late to clear this if we have children
        // inserted already.
      }
    } else if (propKey === CHILDREN) {
      if (
        lastProp !== nextProp &&
        (typeof nextProp === "string" || typeof nextProp === "number")
      ) {
        ;(updatePayload = updatePayload || []).push(propKey, "" + nextProp)
      }
    } else if (
      (enableFlareAPI && propKey === LISTENERS) ||
      propKey === SUPPRESS_CONTENT_EDITABLE_WARNING ||
      propKey === SUPPRESS_HYDRATION_WARNING
    ) {
      // Noop
    } else if (registrationNameModules.hasOwnProperty(propKey)) {
      if (nextProp != null) {
        // We eagerly listen to this even though we haven't committed yet.
        if (__DEV__ && typeof nextProp !== "function") {
          warnForInvalidEventListener(propKey, nextProp)
        }
        ensureListeningTo(rootContainerElement, propKey)
      }
      if (!updatePayload && lastProp !== nextProp) {
        // This is a special case. If any listener updates we need to ensure
        // that the "current" props pointer gets updated so we need a commit
        // to update this element.
        updatePayload = []
      }
    } else {
      // For any other property we always add it to the queue and then we
      // filter it out using the whitelist during the commit.
      ;(updatePayload = updatePayload || []).push(propKey, nextProp)
    }
  }
  if (styleUpdates) {
    ;(updatePayload = updatePayload || []).push(STYLE, styleUpdates)
  }
  return updatePayload
}

// Apply the diff.
export function updateProperties(
  domElement: Element,
  updatePayload: Array<any>,
  tag: string,
  lastRawProps: Object,
  nextRawProps: Object
): void {
  if (
    tag === "input" &&
    nextRawProps.type === "radio" &&
    nextRawProps.name != null
  ) {
    ReactDOMInputUpdateChecked(domElement, nextRawProps)
  }

  const wasCustomComponentTag = isCustomComponent(tag, lastRawProps)
  const isCustomComponentTag = isCustomComponent(tag, nextRawProps)
  updateDOMProperties(
    domElement,
    updatePayload,
    wasCustomComponentTag,
    isCustomComponentTag
  )

  switch (tag) {
    case "input":
      ReactDOMInputUpdateWrapper(domElement, nextRawProps)
      break
    case "textarea":
      ReactDOMTextareaUpdateWrapper(domElement, nextRawProps)
      break
    case "select":
      ReactDOMSelectPostUpdateWrapper(domElement, nextRawProps)
      break
  }
}

// dev
function getPossibleStandardName(propName: string): string | null {
  return null
}

export function diffHydratedProperties(
  domElement: Element,
  tag: string,
  rawProps: Object,
  parentNamespace: string,
  rootContainerElement: Element | Document
): null | Array<mixed> {
  let isCustomComponentTag
  let extraAttributeNames: Set<string>

  switch (tag) {
    case "iframe":
    case "object":
    case "embed":
      trapBubbledEvent(TOP_LOAD, domElement)
      break
    case "video":
    case "audio":
      // Create listener for each media event
      for (let i = 0; i < mediaEventTypes.length; i++) {
        trapBubbledEvent(mediaEventTypes[i], domElement)
      }
      break
    case "source":
      trapBubbledEvent(TOP_ERROR, domElement)
      break
    case "img":
    case "image":
    case "link":
      trapBubbledEvent(TOP_ERROR, domElement)
      trapBubbledEvent(TOP_LOAD, domElement)
      break
    case "form":
      trapBubbledEvent(TOP_RESET, domElement)
      trapBubbledEvent(TOP_SUBMIT, domElement)
      break
    case "details":
      trapBubbledEvent(TOP_TOGGLE, domElement)
      break
    case "input":
      ReactDOMInputInitWrapperState(domElement, rawProps)
      trapBubbledEvent(TOP_INVALID, domElement)
      ensureListeningTo(rootContainerElement, "onChange")
      break
    case "option":
      ReactDOMOptionValidateProps(domElement, rawProps)
      break
    case "select":
      ReactDOMSelectInitWrapperState(domElement, rawProps)
      trapBubbledEvent(TOP_INVALID, domElement)
      ensureListeningTo(rootContainerElement, "onChange")
      break
    case "textarea":
      ReactDOMTextareaInitWrapperState(domElement, rawProps)
      trapBubbledEvent(TOP_INVALID, domElement)
      ensureListeningTo(rootContainerElement, "onChange")
      break
  }

  assertValidProps(tag, rawProps)

  let updatePayload = null
  for (const propKey in rawProps) {
    if (!rawProps.hasOwnProperty(propKey)) {
      continue
    }
    const nextProp = rawProps[propKey]
    if (propKey === CHILDREN) {
      //对于文本内容子级，我们将其与textContent进行比较。这个
      //可能与我们使用读取时隐藏的其他HTML匹配
      //textContent。例如。 “ foo”将匹配“ f <span> oo </span>”，但仍然
      //满足我们的要求。我们的要求不是产生完美
      //HTML和属性。理想情况下，我们应该保留结构，但这是
      //确定不可见的内容是否仍然足以指示
      //即使是侦听器，这些节点也可能被连接。
      //TODO：如果有多个textNode作为子节点，则发出警告。
      //TODO：我们应该使用domElement.firstChild.nodeValue进行比较吗？
      if (typeof nextProp === "string") {
        if (domElement.textContent !== nextProp) {
          updatePayload = [CHILDREN, nextProp]
        }
      } else if (typeof nextProp === "number") {
        if (domElement.textContent !== "" + nextProp) {
          updatePayload = [CHILDREN, "" + nextProp]
        }
      }
    } else if (registrationNameModules.hasOwnProperty(propKey)) {
      if (nextProp != null) {
        ensureListeningTo(rootContainerElement, propKey)
      }
    }
  }

  switch (tag) {
    case "input":
      // TODO: Make sure we check if this is still unmounted or do any clean
      // up necessary since we never stop tracking anymore.
      track((domElement: any))
      ReactDOMInputPostMountWrapper(domElement, rawProps, true)
      break
    case "textarea":
      // TODO: Make sure we check if this is still unmounted or do any clean
      // up necessary since we never stop tracking anymore.
      track((domElement: any))
      ReactDOMTextareaPostMountWrapper(domElement, rawProps)
      break
    case "select":
    case "option":
      // For input and textarea we current always set the value property at
      // post mount to force it to diverge from attributes. However, for
      // option and select we don't quite do the same thing and select
      // is not resilient to the DOM state changing so we don't do that here.
      // TODO: Consider not doing this for input and textarea.
      break
    default:
      if (typeof rawProps.onClick === "function") {
        // TODO: This cast may not be sound for SVG, MathML or custom elements.
        trapClickOnNonInteractiveElement(((domElement: any): HTMLElement))
      }
      break
  }

  return updatePayload
}

export function diffHydratedText(textNode: Text, text: string): boolean {
  const isDifferent = textNode.nodeValue !== text
  return isDifferent
}

export function restoreControlledState(
  domElement: Element,
  tag: string,
  props: Object
): void {
  switch (tag) {
    case "input":
      ReactDOMInputRestoreControlledState(domElement, props)
      return
    case "textarea":
      ReactDOMTextareaRestoreControlledState(domElement, props)
      return
    case "select":
      ReactDOMSelectRestoreControlledState(domElement, props)
      return
  }
}

export function listenToEventResponderEventTypes(
  eventTypes: Array<string>,
  element: Element | Document
): void {
  if (enableFlareAPI) {
    // Get the listening Set for this element. We use this to track
    // what events we're listening to.
    const listeningSet = getListeningSetForElement(element)

    // Go through each target event type of the event responder
    for (let i = 0, length = eventTypes.length; i < length; ++i) {
      const eventType = eventTypes[i]
      const isPassive = !endsWith(eventType, "_active")
      const eventKey = isPassive ? eventType + "_passive" : eventType
      const targetEventType = isPassive
        ? eventType
        : eventType.substring(0, eventType.length - 7)
      if (!listeningSet.has(eventKey)) {
        trapEventForResponderEventSystem(
          element,
          ((targetEventType: any): DOMTopLevelEventType),
          isPassive
        )
        listeningSet.add(eventKey)
      }
    }
  }
}

// We can remove this once the event API is stable and out of a flag
if (enableFlareAPI) {
  setListenToResponderEventTypes(listenToEventResponderEventTypes)
}
