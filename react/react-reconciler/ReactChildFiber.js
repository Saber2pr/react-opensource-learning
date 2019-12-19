/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type { ReactElement } from "shared/ReactElementType"
import type { ReactPortal } from "shared/ReactTypes"
import type { Fiber } from "./ReactFiber"
import type { ExpirationTime } from "./ReactFiberExpirationTime"

import getComponentName from "shared/getComponentName"
import { Placement, Deletion } from "shared/ReactSideEffectTags"
import {
  getIteratorFn,
  REACT_ELEMENT_TYPE,
  REACT_FRAGMENT_TYPE,
  REACT_PORTAL_TYPE
} from "shared/ReactSymbols"
import {
  FunctionComponent,
  ClassComponent,
  HostText,
  HostPortal,
  Fragment
} from "shared/ReactWorkTags"
import invariant from "shared/invariant"
import warning from "shared/warning"
import warningWithoutStack from "shared/warningWithoutStack"
import { warnAboutStringRefs } from "shared/ReactFeatureFlags"

import {
  createWorkInProgress,
  resetWorkInProgress,
  createFiberFromElement,
  createFiberFromFragment,
  createFiberFromText,
  createFiberFromPortal
} from "./ReactFiber"
import { emptyRefsObject } from "./ReactFiberClassComponent"
import {
  getCurrentFiberStackInDev,
  getStackByFiberInDevAndProd
} from "./ReactCurrentFiber"
import { isCompatibleFamilyForHotReloading } from "./ReactFiberHotReloading"
import { StrictMode } from "./ReactTypeOfMode"

let didWarnAboutMaps
let didWarnAboutGenerators
let didWarnAboutStringRefs
let ownerHasKeyUseWarning
let ownerHasFunctionTypeWarning
let warnForMissingKey = (child: mixed) => {}

const isArray = Array.isArray

function coerceRef(
  returnFiber: Fiber,
  current: Fiber | null,
  element: ReactElement
) {
  let mixedRef = element.ref
  if (
    mixedRef !== null &&
    typeof mixedRef !== "function" &&
    typeof mixedRef !== "object"
  ) {
    if (element._owner) {
      const owner: ?Fiber = (element._owner: any)
      let inst
      if (owner) {
        const ownerFiber = ((owner: any): Fiber)
        invariant(
          ownerFiber.tag === ClassComponent,
          "Function components cannot have refs. " +
            "Did you mean to use React.forwardRef()?"
        )
        inst = ownerFiber.stateNode
      }
      invariant(
        inst,
        "Missing owner for string ref %s. This error is likely caused by a " +
          "bug in React. Please file an issue.",
        mixedRef
      )
      const stringRef = "" + mixedRef
      // Check if previous string ref matches new string ref
      if (
        current !== null &&
        current.ref !== null &&
        typeof current.ref === "function" &&
        current.ref._stringRef === stringRef
      ) {
        return current.ref
      }
      const ref = function(value) {
        let refs = inst.refs
        if (refs === emptyRefsObject) {
          // This is a lazy pooled frozen object, so we need to initialize.
          refs = inst.refs = {}
        }
        if (value === null) {
          delete refs[stringRef]
        } else {
          refs[stringRef] = value
        }
      }
      ref._stringRef = stringRef
      return ref
    }
  }
  return mixedRef
}

function throwOnInvalidObjectType(returnFiber: Fiber, newChild: Object) {
  if (returnFiber.type !== "textarea") {
    let addendum = ""
  }
}

function warnOnFunctionType() {
  const currentComponentErrorInfo =
    "Functions are not valid as a React child. This may happen if " +
    "you return a Component instead of <Component /> from render. " +
    "Or maybe you meant to call this function rather than return it." +
    getCurrentFiberStackInDev()

  if (ownerHasFunctionTypeWarning[currentComponentErrorInfo]) {
    return
  }
  ownerHasFunctionTypeWarning[currentComponentErrorInfo] = true

  warning(
    false,
    "Functions are not valid as a React child. This may happen if " +
      "you return a Component instead of <Component /> from render. " +
      "Or maybe you meant to call this function rather than return it."
  )
}

// This wrapper function exists because I expect to clone the code in each path
// to be able to optimize each path individually by branching early. This needs
// a compiler or we can do it manually. Helpers that don't need this branching
// live outside of this function.
function ChildReconciler(shouldTrackSideEffects) {
  function deleteChild(returnFiber: Fiber, childToDelete: Fiber): void {
    if (!shouldTrackSideEffects) {
      // Noop.
      return
    }
    // Deletions are added in reversed order so we add it to the front.
    // At this point, the return fiber's effect list is empty except for
    // deletions, so we can just append the deletion to the list. The remaining
    // effects aren't added until the complete phase. Once we implement
    // resuming, this may not be true.
    const last = returnFiber.lastEffect
    if (last !== null) {
      last.nextEffect = childToDelete
      returnFiber.lastEffect = childToDelete
    } else {
      returnFiber.firstEffect = returnFiber.lastEffect = childToDelete
    }
    childToDelete.nextEffect = null
    childToDelete.effectTag = Deletion
  }

  function deleteRemainingChildren(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null
  ): null {
    if (!shouldTrackSideEffects) {
      // Noop.
      return null
    }

    // TODO: For the shouldClone case, this could be micro-optimized a bit by
    // assuming that after the first child we've already added everything.
    let childToDelete = currentFirstChild
    while (childToDelete !== null) {
      deleteChild(returnFiber, childToDelete)
      childToDelete = childToDelete.sibling
    }
    return null
  }

  // 快速访问child的map
  function mapRemainingChildren(
    returnFiber: Fiber,
    currentFirstChild: Fiber
  ): Map<string | number, Fiber> {
    const existingChildren: Map<string | number, Fiber> = new Map()

    let existingChild = currentFirstChild
    while (existingChild !== null) {
      if (existingChild.key !== null) {
        existingChildren.set(existingChild.key, existingChild)
      } else {
        existingChildren.set(existingChild.index, existingChild)
      }
      existingChild = existingChild.sibling
    }
    return existingChildren
  }

  function useFiber(
    fiber: Fiber,
    pendingProps: mixed,
    expirationTime: ExpirationTime
  ): Fiber {
    // We currently set sibling to null and index to 0 here because it is easy
    // to forget to do before returning it. E.g. for the single child case.
    const clone = createWorkInProgress(fiber, pendingProps, expirationTime)
    clone.index = 0
    clone.sibling = null
    return clone
  }

  function placeChild(
    newFiber: Fiber,
    lastPlacedIndex: number,
    newIndex: number
  ): number {
    newFiber.index = newIndex
    if (!shouldTrackSideEffects) {
      // Noop.
      return lastPlacedIndex
    }
    // 拿到当前fiber对应旧的fiber
    const current = newFiber.alternate
    if (current !== null) {
      const oldIndex = current.index
      // 对比新旧fiber的index，如果不同则判定为移动
      if (oldIndex < lastPlacedIndex) {
        newFiber.effectTag = Placement // place
        return lastPlacedIndex
      } else {
        return oldIndex // update
      }
    } else {
      // 如果当前fiber没有alternate属性，则判定为创建create
      newFiber.effectTag = Placement // create
      return lastPlacedIndex
    }
  }

  function placeSingleChild(newFiber: Fiber): Fiber {
    // This is simpler for the single child case. We only need to do a
    // placement for inserting new children.
    if (shouldTrackSideEffects && newFiber.alternate === null) {
      newFiber.effectTag = Placement
    }
    return newFiber
  }

  function updateTextNode(
    returnFiber: Fiber,
    current: Fiber | null,
    textContent: string,
    expirationTime: ExpirationTime
  ) {
    if (current === null || current.tag !== HostText) {
      // Insert
      const created = createFiberFromText(
        textContent,
        returnFiber.mode,
        expirationTime
      )
      created.return = returnFiber
      return created
    } else {
      // Update
      const existing = useFiber(current, textContent, expirationTime)
      existing.return = returnFiber
      return existing
    }
  }

  function updateElement(
    returnFiber: Fiber,
    current: Fiber | null,
    element: ReactElement,
    expirationTime: ExpirationTime
  ): Fiber {
    if (current !== null && current.elementType === element.type) {
      // Move based on index
      const existing = useFiber(current, element.props, expirationTime)
      existing.ref = coerceRef(returnFiber, current, element)
      existing.return = returnFiber
      return existing
    } else {
      // Insert
      const created = createFiberFromElement(
        element,
        returnFiber.mode,
        expirationTime
      )
      created.ref = coerceRef(returnFiber, current, element)
      created.return = returnFiber
      return created
    }
  }

  function updatePortal(
    returnFiber: Fiber,
    current: Fiber | null,
    portal: ReactPortal,
    expirationTime: ExpirationTime
  ): Fiber {
    if (
      current === null ||
      current.tag !== HostPortal ||
      current.stateNode.containerInfo !== portal.containerInfo ||
      current.stateNode.implementation !== portal.implementation
    ) {
      // Insert
      const created = createFiberFromPortal(
        portal,
        returnFiber.mode,
        expirationTime
      )
      created.return = returnFiber
      return created
    } else {
      // Update
      const existing = useFiber(current, portal.children || [], expirationTime)
      existing.return = returnFiber
      return existing
    }
  }

  function updateFragment(
    returnFiber: Fiber,
    current: Fiber | null,
    fragment: Iterable<*>,
    expirationTime: ExpirationTime,
    key: null | string
  ): Fiber {
    if (current === null || current.tag !== Fragment) {
      // Insert
      const created = createFiberFromFragment(
        fragment,
        returnFiber.mode,
        expirationTime,
        key
      )
      created.return = returnFiber
      return created
    } else {
      // Update
      const existing = useFiber(current, fragment, expirationTime)
      existing.return = returnFiber
      return existing
    }
  }

  function createChild(
    returnFiber: Fiber,
    newChild: any,
    expirationTime: ExpirationTime
  ): Fiber | null {
    if (typeof newChild === "string" || typeof newChild === "number") {
      // Text nodes don't have keys. If the previous node is implicitly keyed
      // we can continue to replace it without aborting even if it is not a text
      // node.
      const created = createFiberFromText(
        "" + newChild,
        returnFiber.mode,
        expirationTime
      )
      created.return = returnFiber
      return created
    }

    if (typeof newChild === "object" && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE: {
          const created = createFiberFromElement(
            newChild,
            returnFiber.mode,
            expirationTime
          )
          created.ref = coerceRef(returnFiber, null, newChild)
          created.return = returnFiber
          return created
        }
        case REACT_PORTAL_TYPE: {
          const created = createFiberFromPortal(
            newChild,
            returnFiber.mode,
            expirationTime
          )
          created.return = returnFiber
          return created
        }
      }

      if (isArray(newChild) || getIteratorFn(newChild)) {
        const created = createFiberFromFragment(
          newChild,
          returnFiber.mode,
          expirationTime,
          null
        )
        created.return = returnFiber
        return created
      }

      throwOnInvalidObjectType(returnFiber, newChild)
    }

    return null
  }

  function updateSlot(
    returnFiber: Fiber,
    oldFiber: Fiber | null,
    newChild: any,
    expirationTime: ExpirationTime
  ): Fiber | null {
    const key = oldFiber !== null ? oldFiber.key : null

    if (typeof newChild === "string" || typeof newChild === "number") {
      if (key !== null) {
        return null
      }
      return updateTextNode(
        returnFiber,
        oldFiber,
        "" + newChild,
        expirationTime
      )
    }

    if (typeof newChild === "object" && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE: {
          if (newChild.key === key) {
            if (newChild.type === REACT_FRAGMENT_TYPE) {
              return updateFragment(
                returnFiber,
                oldFiber,
                newChild.props.children,
                expirationTime,
                key
              )
            }
            return updateElement(
              returnFiber,
              oldFiber,
              newChild,
              expirationTime
            )
          } else {
            return null
          }
        }
        case REACT_PORTAL_TYPE: {
          if (newChild.key === key) {
            return updatePortal(returnFiber, oldFiber, newChild, expirationTime)
          } else {
            return null
          }
        }
      }

      if (isArray(newChild) || getIteratorFn(newChild)) {
        if (key !== null) {
          return null
        }

        return updateFragment(
          returnFiber,
          oldFiber,
          newChild,
          expirationTime,
          null
        )
      }

      throwOnInvalidObjectType(returnFiber, newChild)
    }

    return null
  }

  function updateFromMap(
    existingChildren: Map<string | number, Fiber>,
    returnFiber: Fiber,
    newIdx: number,
    newChild: any,
    expirationTime: ExpirationTime
  ): Fiber | null {
    if (typeof newChild === "string" || typeof newChild === "number") {
      // Text nodes don't have keys, so we neither have to check the old nor
      // new node for the key. If both are text nodes, they match.
      const matchedFiber = existingChildren.get(newIdx) || null
      return updateTextNode(
        returnFiber,
        matchedFiber,
        "" + newChild,
        expirationTime
      )
    }

    if (typeof newChild === "object" && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE: {
          const matchedFiber =
            existingChildren.get(
              newChild.key === null ? newIdx : newChild.key
            ) || null
          if (newChild.type === REACT_FRAGMENT_TYPE) {
            return updateFragment(
              returnFiber,
              matchedFiber,
              newChild.props.children,
              expirationTime,
              newChild.key
            )
          }
          return updateElement(
            returnFiber,
            matchedFiber,
            newChild,
            expirationTime
          )
        }
        case REACT_PORTAL_TYPE: {
          const matchedFiber =
            existingChildren.get(
              newChild.key === null ? newIdx : newChild.key
            ) || null
          return updatePortal(
            returnFiber,
            matchedFiber,
            newChild,
            expirationTime
          )
        }
      }

      if (isArray(newChild) || getIteratorFn(newChild)) {
        const matchedFiber = existingChildren.get(newIdx) || null
        return updateFragment(
          returnFiber,
          matchedFiber,
          newChild,
          expirationTime,
          null
        )
      }

      throwOnInvalidObjectType(returnFiber, newChild)
    }

    return null
  }

  /**
   * Warns if there is a duplicate or missing key
   */
  function warnOnInvalidKey(
    child: mixed,
    knownKeys: Set<string> | null
  ): Set<string> | null {
    return knownKeys
  }

  function reconcileChildrenArray(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    newChildren: Array<*>,
    expirationTime: ExpirationTime
  ): Fiber | null {
    if (__DEV__) {
      // 遍历新链表，检查key是否重复
      // 内部利用Set结构存储fiber.key
      let knownKeys = null
      for (let i = 0; i < newChildren.length; i++) {
        const child = newChildren[i]
        knownKeys = warnOnInvalidKey(child, knownKeys)
      }
    }

    let resultingFirstChild: Fiber | null = null
    let previousNewFiber: Fiber | null = null

    let oldFiber = currentFirstChild
    let lastPlacedIndex = 0
    let newIdx = 0
    let nextOldFiber = null

    // 遍历新旧两条链表(重合的部分)
    // newChildren链表和oldFiber的sibling方向链表
    for (; oldFiber !== null && newIdx < newChildren.length; newIdx++) {
      if (oldFiber.index > newIdx) {
        nextOldFiber = oldFiber
        oldFiber = null
      } else {
        nextOldFiber = oldFiber.sibling
      }

      // updateSlot和updateFromMap做的是一样的，只是没有map用来快速访问child
      const newFiber = updateSlot(
        returnFiber,
        oldFiber,
        newChildren[newIdx],
        expirationTime
      )

      if (newFiber === null) {
        if (oldFiber === null) {
          oldFiber = nextOldFiber
        }
        break
      }

      if (shouldTrackSideEffects) {
        if (oldFiber && newFiber.alternate === null) {
          deleteChild(returnFiber, oldFiber)
        }
      }

      lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx)

      if (previousNewFiber === null) {
        resultingFirstChild = newFiber
      } else {
        previousNewFiber.sibling = newFiber
      }

      previousNewFiber = newFiber
      oldFiber = nextOldFiber
    }

    // 如果遍历到新链表的尾部
    // 把旧链表后续多余部分全部删除
    if (newIdx === newChildren.length) {
      deleteRemainingChildren(returnFiber, oldFiber)
      return resultingFirstChild
    }

    // 旧链表已经遍历完，遍历新链表后续部分
    // 创建新的节点
    if (oldFiber === null) {
      for (; newIdx < newChildren.length; newIdx++) {
        const newFiber = createChild(
          returnFiber,
          newChildren[newIdx],
          expirationTime
        )
        if (newFiber === null) {
          continue
        }
        lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx)

        if (previousNewFiber === null) {
          // 记录下第一个child
          resultingFirstChild = newFiber
        } else {
          // 链接新的sibling方向链表
          previousNewFiber.sibling = newFiber
        }
        // previousNewFiber指针指向新的fiber
        previousNewFiber = newFiber
      }
      return resultingFirstChild
    }

    // 将sibling方向链表转为map，即 Map { fiber.key => fiber }
    // 加速children元素的访问
    const existingChildren = mapRemainingChildren(returnFiber, oldFiber)

    // 旧链表已经遍历完，遍历新链表后续部分
    for (; newIdx < newChildren.length; newIdx++) {
      // 从existingChildren map中利用key找到节点
      // 然后根据component.$$typeof属性区分类型，比如是element还是portal，
      // element根据fiber.type又分为fragment和CC、FC
      // 然后利用alternate属性对比新旧节点
      const newFiber = updateFromMap(
        existingChildren,
        returnFiber,
        newIdx,
        newChildren[newIdx],
        expirationTime
      )
      if (newFiber !== null) {
        if (shouldTrackSideEffects) {
          if (newFiber.alternate !== null) {
            existingChildren.delete(
              newFiber.key === null ? newIdx : newFiber.key
            )
          }
        }
        // 新旧更替
        lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx)

        if (previousNewFiber === null) {
          // parentFiber.child即第一个child
          resultingFirstChild = newFiber
        } else {
          // 链接新的sibling方向链表
          previousNewFiber.sibling = newFiber
        }
        // previousNewFiber指针指向新的fiber
        previousNewFiber = newFiber
      }
    }

    if (shouldTrackSideEffects) {
      existingChildren.forEach(child => deleteChild(returnFiber, child))
    }

    // 返回parentFiber.child的第一个child
    return resultingFirstChild
  }

  function reconcileChildrenIterator(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    newChildrenIterable: Iterable<*>,
    expirationTime: ExpirationTime
  ): Fiber | null {
    // This is the same implementation as reconcileChildrenArray(),
    // but using the iterator instead.

    const iteratorFn = getIteratorFn(newChildrenIterable)
    invariant(
      typeof iteratorFn === "function",
      "An object is not an iterable. This error is likely caused by a bug in " +
        "React. Please file an issue."
    )

    const newChildren = iteratorFn.call(newChildrenIterable)
    invariant(newChildren != null, "An iterable object provided no iterator.")

    let resultingFirstChild: Fiber | null = null
    let previousNewFiber: Fiber | null = null

    let oldFiber = currentFirstChild
    let lastPlacedIndex = 0
    let newIdx = 0
    let nextOldFiber = null

    let step = newChildren.next()
    for (
      ;
      oldFiber !== null && !step.done;
      newIdx++, step = newChildren.next()
    ) {
      if (oldFiber.index > newIdx) {
        nextOldFiber = oldFiber
        oldFiber = null
      } else {
        nextOldFiber = oldFiber.sibling
      }
      const newFiber = updateSlot(
        returnFiber,
        oldFiber,
        step.value,
        expirationTime
      )
      if (newFiber === null) {
        // TODO: This breaks on empty slots like null children. That's
        // unfortunate because it triggers the slow path all the time. We need
        // a better way to communicate whether this was a miss or null,
        // boolean, undefined, etc.
        if (oldFiber === null) {
          oldFiber = nextOldFiber
        }
        break
      }
      if (shouldTrackSideEffects) {
        if (oldFiber && newFiber.alternate === null) {
          // We matched the slot, but we didn't reuse the existing fiber, so we
          // need to delete the existing child.
          deleteChild(returnFiber, oldFiber)
        }
      }
      lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx)
      if (previousNewFiber === null) {
        // TODO: Move out of the loop. This only happens for the first run.
        resultingFirstChild = newFiber
      } else {
        // TODO: Defer siblings if we're not at the right index for this slot.
        // I.e. if we had null values before, then we want to defer this
        // for each null value. However, we also don't want to call updateSlot
        // with the previous one.
        previousNewFiber.sibling = newFiber
      }
      previousNewFiber = newFiber
      oldFiber = nextOldFiber
    }

    if (step.done) {
      // We've reached the end of the new children. We can delete the rest.
      deleteRemainingChildren(returnFiber, oldFiber)
      return resultingFirstChild
    }

    if (oldFiber === null) {
      // If we don't have any more existing children we can choose a fast path
      // since the rest will all be insertions.
      for (; !step.done; newIdx++, step = newChildren.next()) {
        const newFiber = createChild(returnFiber, step.value, expirationTime)
        if (newFiber === null) {
          continue
        }
        lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx)
        if (previousNewFiber === null) {
          // TODO: Move out of the loop. This only happens for the first run.
          resultingFirstChild = newFiber
        } else {
          previousNewFiber.sibling = newFiber
        }
        previousNewFiber = newFiber
      }
      return resultingFirstChild
    }

    // Add all children to a key map for quick lookups.
    const existingChildren = mapRemainingChildren(returnFiber, oldFiber)

    // Keep scanning and use the map to restore deleted items as moves.
    for (; !step.done; newIdx++, step = newChildren.next()) {
      const newFiber = updateFromMap(
        existingChildren,
        returnFiber,
        newIdx,
        step.value,
        expirationTime
      )
      if (newFiber !== null) {
        if (shouldTrackSideEffects) {
          if (newFiber.alternate !== null) {
            // The new fiber is a work in progress, but if there exists a
            // current, that means that we reused the fiber. We need to delete
            // it from the child list so that we don't add it to the deletion
            // list.
            existingChildren.delete(
              newFiber.key === null ? newIdx : newFiber.key
            )
          }
        }
        lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx)
        if (previousNewFiber === null) {
          resultingFirstChild = newFiber
        } else {
          previousNewFiber.sibling = newFiber
        }
        previousNewFiber = newFiber
      }
    }

    if (shouldTrackSideEffects) {
      // Any existing children that weren't consumed above were deleted. We need
      // to add them to the deletion list.
      existingChildren.forEach(child => deleteChild(returnFiber, child))
    }

    return resultingFirstChild
  }

  function reconcileSingleTextNode(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    textContent: string,
    expirationTime: ExpirationTime
  ): Fiber {
    // There's no need to check for keys on text nodes since we don't have a
    // way to define them.
    if (currentFirstChild !== null && currentFirstChild.tag === HostText) {
      // We already have an existing node so let's just update it and delete
      // the rest.
      deleteRemainingChildren(returnFiber, currentFirstChild.sibling)
      const existing = useFiber(currentFirstChild, textContent, expirationTime)
      existing.return = returnFiber
      return existing
    }
    // The existing first child is not a text node so we need to create one
    // and delete the existing ones.
    deleteRemainingChildren(returnFiber, currentFirstChild)
    const created = createFiberFromText(
      textContent,
      returnFiber.mode,
      expirationTime
    )
    created.return = returnFiber
    return created
  }

  function reconcileSingleElement(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    element: ReactElement,
    expirationTime: ExpirationTime
  ): Fiber {
    const key = element.key
    let child = currentFirstChild
    while (child !== null) {
      // TODO: If key === null and child.key === null, then this only applies to
      // the first item in the list.
      if (child.key === key) {
        if (
          child.tag === Fragment
            ? element.type === REACT_FRAGMENT_TYPE
            : child.elementType === element.type
        ) {
          deleteRemainingChildren(returnFiber, child.sibling)
          const existing = useFiber(
            child,
            element.type === REACT_FRAGMENT_TYPE
              ? element.props.children
              : element.props,
            expirationTime
          )
          existing.ref = coerceRef(returnFiber, child, element)
          existing.return = returnFiber
          return existing
        } else {
          deleteRemainingChildren(returnFiber, child)
          break
        }
      } else {
        deleteChild(returnFiber, child)
      }
      child = child.sibling
    }

    if (element.type === REACT_FRAGMENT_TYPE) {
      const created = createFiberFromFragment(
        element.props.children,
        returnFiber.mode,
        expirationTime,
        element.key
      )
      created.return = returnFiber
      return created
    } else {
      const created = createFiberFromElement(
        element,
        returnFiber.mode,
        expirationTime
      )
      created.ref = coerceRef(returnFiber, currentFirstChild, element)
      created.return = returnFiber
      return created
    }
  }

  function reconcileSinglePortal(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    portal: ReactPortal,
    expirationTime: ExpirationTime
  ): Fiber {
    const key = portal.key
    let child = currentFirstChild
    while (child !== null) {
      // TODO: If key === null and child.key === null, then this only applies to
      // the first item in the list.
      if (child.key === key) {
        if (
          child.tag === HostPortal &&
          child.stateNode.containerInfo === portal.containerInfo &&
          child.stateNode.implementation === portal.implementation
        ) {
          deleteRemainingChildren(returnFiber, child.sibling)
          const existing = useFiber(
            child,
            portal.children || [],
            expirationTime
          )
          existing.return = returnFiber
          return existing
        } else {
          deleteRemainingChildren(returnFiber, child)
          break
        }
      } else {
        deleteChild(returnFiber, child)
      }
      child = child.sibling
    }

    const created = createFiberFromPortal(
      portal,
      returnFiber.mode,
      expirationTime
    )
    created.return = returnFiber
    return created
  }

  // This API will tag the children with the side-effect of the reconciliation
  // itself. They will be added to the side-effect list as we pass through the
  // children and the parent.
  function reconcileChildFibers(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    newChild: any,
    expirationTime: ExpirationTime
  ): Fiber | null {
    // This function is not recursive.
    // If the top level item is an array, we treat it as a set of children,
    // not as a fragment. Nested arrays on the other hand will be treated as
    // fragment nodes. Recursion happens at the normal flow.

    // Handle top level unkeyed fragments as if they were arrays.
    // This leads to an ambiguity between <>{[...]}</> and <>...</>.
    // We treat the ambiguous cases above the same.
    const isUnkeyedTopLevelFragment =
      typeof newChild === "object" &&
      newChild !== null &&
      newChild.type === REACT_FRAGMENT_TYPE &&
      newChild.key === null
    if (isUnkeyedTopLevelFragment) {
      newChild = newChild.props.children
    }

    // Handle object types
    const isObject = typeof newChild === "object" && newChild !== null

    if (isObject) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE:
          return placeSingleChild(
            reconcileSingleElement(
              returnFiber,
              currentFirstChild,
              newChild,
              expirationTime
            )
          )
        case REACT_PORTAL_TYPE:
          return placeSingleChild(
            reconcileSinglePortal(
              returnFiber,
              currentFirstChild,
              newChild,
              expirationTime
            )
          )
      }
    }

    if (typeof newChild === "string" || typeof newChild === "number") {
      return placeSingleChild(
        reconcileSingleTextNode(
          returnFiber,
          currentFirstChild,
          "" + newChild,
          expirationTime
        )
      )
    }

    if (isArray(newChild)) {
      return reconcileChildrenArray(
        returnFiber,
        currentFirstChild,
        newChild,
        expirationTime
      )
    }

    if (getIteratorFn(newChild)) {
      return reconcileChildrenIterator(
        returnFiber,
        currentFirstChild,
        newChild,
        expirationTime
      )
    }

    if (isObject) {
      throwOnInvalidObjectType(returnFiber, newChild)
    }

    if (typeof newChild === "undefined" && !isUnkeyedTopLevelFragment) {
      // If the new child is undefined, and the return fiber is a composite
      // component, throw an error. If Fiber return types are disabled,
      // we already threw above.
      switch (returnFiber.tag) {
        case ClassComponent:
        // Intentionally fall through to the next case, which handles both
        // functions and classes
        // eslint-disable-next-lined no-fallthrough
        case FunctionComponent:
      }
    }

    // Remaining cases are all treated as empty.
    return deleteRemainingChildren(returnFiber, currentFirstChild)
  }

  return reconcileChildFibers
}

export const reconcileChildFibers = ChildReconciler(true)
export const mountChildFibers = ChildReconciler(false)

export function cloneChildFibers(
  current: Fiber | null,
  workInProgress: Fiber
): void {
  if (workInProgress.child === null) {
    return
  }

  let currentChild = workInProgress.child
  let newChild = createWorkInProgress(
    currentChild,
    currentChild.pendingProps,
    currentChild.expirationTime
  )
  workInProgress.child = newChild

  newChild.return = workInProgress
  while (currentChild.sibling !== null) {
    currentChild = currentChild.sibling
    newChild = newChild.sibling = createWorkInProgress(
      currentChild,
      currentChild.pendingProps,
      currentChild.expirationTime
    )
    newChild.return = workInProgress
  }
  newChild.sibling = null
}

// Reset a workInProgress child set to prepare it for a second pass.
export function resetChildFibers(
  workInProgress: Fiber,
  renderExpirationTime: ExpirationTime
): void {
  let child = workInProgress.child
  while (child !== null) {
    resetWorkInProgress(child, renderExpirationTime)
    child = child.sibling
  }
}
