/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {ReactElement, Source} from 'shared/ReactElementType';
import type {
  ReactFragment,
  ReactPortal,
  RefObject,
  ReactEventResponder,
  ReactEventResponderInstance,
  ReactFundamentalComponent,
} from 'shared/ReactTypes';
import type {RootTag} from 'shared/ReactRootTags';
import type {WorkTag} from 'shared/ReactWorkTags';
import type {TypeOfMode} from './ReactTypeOfMode';
import type {SideEffectTag} from 'shared/ReactSideEffectTags';
import type {ExpirationTime} from './ReactFiberExpirationTime';
import type {UpdateQueue} from './ReactUpdateQueue';
import type {ContextDependency} from './ReactFiberNewContext';
import type {HookType} from './ReactFiberHooks';
import type {SuspenseInstance} from './ReactFiberHostConfig';

import invariant from 'shared/invariant';
import warningWithoutStack from 'shared/warningWithoutStack';
import {
  enableProfilerTimer,
  enableFundamentalAPI,
  enableUserTimingAPI,
} from 'shared/ReactFeatureFlags';
import {NoEffect, Placement} from 'shared/ReactSideEffectTags';
import {ConcurrentRoot, BatchedRoot} from 'shared/ReactRootTags';
import {
  IndeterminateComponent,
  ClassComponent,
  HostRoot,
  HostComponent,
  HostText,
  HostPortal,
  ForwardRef,
  Fragment,
  Mode,
  ContextProvider,
  ContextConsumer,
  Profiler,
  SuspenseComponent,
  SuspenseListComponent,
  DehydratedFragment,
  FunctionComponent,
  MemoComponent,
  SimpleMemoComponent,
  LazyComponent,
  FundamentalComponent,
} from 'shared/ReactWorkTags';
import getComponentName from 'shared/getComponentName';

import {isDevToolsPresent} from './ReactFiberDevToolsHook';
import {
  resolveClassForHotReloading,
  resolveFunctionForHotReloading,
  resolveForwardRefForHotReloading,
} from './ReactFiberHotReloading';
import {NoWork} from './ReactFiberExpirationTime';
import {
  NoMode,
  ConcurrentMode,
  ProfileMode,
  StrictMode,
  BatchedMode,
} from './ReactTypeOfMode';
import {
  REACT_FORWARD_REF_TYPE,
  REACT_FRAGMENT_TYPE,
  REACT_STRICT_MODE_TYPE,
  REACT_PROFILER_TYPE,
  REACT_PROVIDER_TYPE,
  REACT_CONTEXT_TYPE,
  REACT_CONCURRENT_MODE_TYPE,
  REACT_SUSPENSE_TYPE,
  REACT_SUSPENSE_LIST_TYPE,
  REACT_MEMO_TYPE,
  REACT_LAZY_TYPE,
  REACT_FUNDAMENTAL_TYPE,
} from 'shared/ReactSymbols';

export type Dependencies = {
  expirationTime: ExpirationTime,
  firstContext: ContextDependency<mixed> | null,
  responders: Map<
    ReactEventResponder<any, any>,
    ReactEventResponderInstance<any, any>,
  > | null,
};

//光纤可以在需要完成或已完成的组件上工作。有可以
//每个组件不止一个。
export type Fiber = {|
  tag: WorkTag,
  //这个孩子的唯一标识符。由jsx标签key属性提供，用于diff优化
  key: null | string,
  //element.type的值，用于保存标识期间的标识
  elementType: any,
  //与此光纤关联的已解析函数/类/。
  type: any,
  //与此光纤相关的本地状态。
  stateNode: any,

  return: Fiber | null,
  child: Fiber | null,
  sibling: Fiber | null,

  // 用于条件渲染判断元素位置
  index: number,
  ref: null | (((handle: mixed) => void) & {_stringRef: ?string}) | RefObject,

  // Input is the data coming into process this fiber. Arguments. Props.
  pendingProps: any, //重载标记后，此类型将更具体。
  memoizedProps: any, // The props used to create the output.

  //状态更新和回调队列。
  updateQueue: UpdateQueue<any> | null,
  //用于创建输出的状态
  memoizedState: any,

  //此光纤的依赖关系（上下文，事件），如果有的话
  dependencies: Dependencies | null,
  mode: TypeOfMode,

  // Effect
  effectTag: SideEffectTag,
  //单链表列出了具有副作用的下一个光纤的快速路径。
  nextEffect: Fiber | null,

  //此子树中具有副作用的第一个和最后一个光纤。这允许
  //当我们重复使用内部工作时，我们重用链表的一部分
  //这根纤维 
  firstEffect: Fiber | null,
  lastEffect: Fiber | null,

  //表示将来完成此工作的时间。
  //不包括在其子树中找到的工作。
  expirationTime: ExpirationTime,

  //这用于快速确定子树是否没有挂起的更改。
  childExpirationTime: ExpirationTime,

  alternate: Fiber | null,

  //为当前更新渲染此光纤及其后代所花费的时间。
  //这告诉我们树如何利用sCU进行记忆。
  //每次渲染时都会重置为0，只有在我们不进行救助时才会更新。
  //此字段仅在启用enableProfilerTimer标志时设置。
  actualDuration?: number,

  //如果光纤当前在“渲染”阶段处于活动状态，
  //这标志着工作开始的时间。
  //此字段仅在启用enableProfilerTimer标志时设置。 
  actualStartTime?: number,

  //此光纤最近渲染时间的持续时间。
  //当我们为了记忆目的而进行救助时，不会更新此值。
  //此字段仅在启用enableProfilerTimer标志时设置。
  selfBaseDuration?: number,

  //此光纤的所有后代的基本时间总和。
  //这个值在“完成”阶段起泡。
  //此字段仅在启用enableProfilerTimer标志时设置。
  treeBaseDuration?: number,
|};

function FiberNode(
  tag: WorkTag,
  pendingProps: mixed,
  key: null | string,
  mode: TypeOfMode,
) {
  // Instance
  this.tag = tag;
  this.key = key;
  this.elementType = null;
  this.type = null;
  this.stateNode = null;

  // Fiber
  this.return = null;
  this.child = null;
  this.sibling = null;
  this.index = 0;

  this.ref = null;

  this.pendingProps = pendingProps;
  this.memoizedProps = null;
  this.updateQueue = null;
  this.memoizedState = null;
  this.dependencies = null;

  this.mode = mode;

  // Effects
  this.effectTag = NoEffect;
  this.nextEffect = null;

  this.firstEffect = null;
  this.lastEffect = null;

  this.expirationTime = NoWork;
  this.childExpirationTime = NoWork;

  this.alternate = null;

  if (enableProfilerTimer) {
    [Comment Translate] Google

    //注意：以下操作是为了避免v8性能悬崖。
    //
    //将以下字段初始化为smis，然后使用更新它们
    //double值会导致Fibers最终形成单独的形状。
    //此行为/错误与Object.preventExtension（）有关。
    //幸运的是，这只会影响DEV构建。
    //不幸的是，它使某些应用程序的React速度非常慢。
    //要解决此问题，请使用双精度初始化下面的字段。
    //
    //在此处了解更多相关信息：
    //https://github.com/facebook/react/issues/14365
    //https://bugs.chromium.org/p/v8/issues/detail?id=8538 
    this.actualDuration = Number.NaN;
    this.actualStartTime = Number.NaN;
    this.selfBaseDuration = Number.NaN;
    this.treeBaseDuration = Number.NaN;

    //初始化后用smis替换初始双打是可以的。
    //这不会触发上面提到的性能悬崖，
    //它简化了其他探查器代码（包括DevTools）。
    this.actualDuration = 0;
    this.actualStartTime = -1;
    this.selfBaseDuration = 0;
    this.treeBaseDuration = 0;
  }
}

const createFiber = function(
  tag: WorkTag,
  pendingProps: mixed,
  key: null | string,
  mode: TypeOfMode,
): Fiber {
  return new FiberNode(tag, pendingProps, key, mode);
};

function shouldConstruct(Component: Function) {
  const prototype = Component.prototype;
  return !!(prototype && prototype.isReactComponent);
}

export function isSimpleFunctionComponent(type: any) {
  return (
    typeof type === 'function' &&
    !shouldConstruct(type) &&
    type.defaultProps === undefined
  );
}

export function resolveLazyComponentTag(Component: Function): WorkTag {
  if (typeof Component === 'function') {
    return shouldConstruct(Component) ? ClassComponent : FunctionComponent;
  } else if (Component !== undefined && Component !== null) {
    const $$typeof = Component.$$typeof;
    if ($$typeof === REACT_FORWARD_REF_TYPE) {
      return ForwardRef;
    }
    if ($$typeof === REACT_MEMO_TYPE) {
      return MemoComponent;
    }
  }
  return IndeterminateComponent;
}

//这用于创建备用光纤以进行工作。
export function createWorkInProgress(
  current: Fiber,
  pendingProps: any,
  expirationTime: ExpirationTime,
): Fiber {
  let workInProgress = current.alternate;
  if (workInProgress === null) {
    //我们使用双缓冲池技术，因为我们知道我们会
    //最多只需要两个版本的树。我们汇集了“其他”未使用的
    //我们可以自由重用的节点。这是懒惰创建以避免分配
    //永远不会更新的东西的额外对象它也允许我们
    //如果需要，回收额外的内存。 
    workInProgress = createFiber(
      current.tag,
      pendingProps,
      current.key,
      current.mode,
    );
    workInProgress.elementType = current.elementType;
    workInProgress.type = current.type;
    workInProgress.stateNode = current.stateNode;

    workInProgress.alternate = current;
    current.alternate = workInProgress;
  } else {
    workInProgress.pendingProps = pendingProps;

    //我们已经有了替补。
    //重置effect标签。 
    workInProgress.effectTag = NoEffect;

    //effect列表不再有效。
    workInProgress.nextEffect = null;
    workInProgress.firstEffect = null;
    workInProgress.lastEffect = null;

    if (enableProfilerTimer) {
      //我们有意重置而不是复制actualDuration和actualStartTime。
      //这可以防止时间在新提交中无休止地累积。
      //这有重置不同优先级渲染值的缺点，
      //但是适合屈服（常见情况），应该支持恢复。 
      workInProgress.actualDuration = 0;
      workInProgress.actualStartTime = -1;
    }
  }

  workInProgress.childExpirationTime = current.childExpirationTime;
  workInProgress.expirationTime = current.expirationTime;

  workInProgress.child = current.child;
  workInProgress.memoizedProps = current.memoizedProps;
  workInProgress.memoizedState = current.memoizedState;
  workInProgress.updateQueue = current.updateQueue;

  //克隆依赖项对象。这在渲染阶段发生变异，因此
  //它不能与当前光纤共享。 
  const currentDependencies = current.dependencies;
  workInProgress.dependencies =
    currentDependencies === null
      ? null
      : {
          expirationTime: currentDependencies.expirationTime,
          firstContext: currentDependencies.firstContext,
          responders: currentDependencies.responders,
        };

  // These will be overridden during the parent's reconciliation
  workInProgress.sibling = current.sibling;
  workInProgress.index = current.index;
  workInProgress.ref = current.ref;

  if (enableProfilerTimer) {
    workInProgress.selfBaseDuration = current.selfBaseDuration;
    workInProgress.treeBaseDuration = current.treeBaseDuration;
  }

  return workInProgress;
}

//用于重复使用Fiber进行第二次传递。
export function resetWorkInProgress(
  workInProgress: Fiber,
  renderExpirationTime: ExpirationTime,
) {
  //这会将光纤重置为createFiber或createWorkInProgress
  //在第一次传递期间将值设置为之前。理想情况下，这不会
  //是必要的但很遗憾，许多代码路径都是从workInProgress中读取的
  //当他们应该从当前阅读并写入workInProgress时。

  //我们假设pendingProps，index，key，ref，return仍未触及
  //避免进行其他reconciliation 
  
  //重置effect标记，但保留任何Placement标记，因为那是什么
  //child fiber正在设置，而不是reconciliation 
  workInProgress.effectTag &= Placement;

  //effect列表不再有效。
  workInProgress.nextEffect = null;
  workInProgress.firstEffect = null;
  workInProgress.lastEffect = null;

  let current = workInProgress.alternate;
  if (current === null) {
    // Reset to createFiber's initial values.
    workInProgress.childExpirationTime = NoWork;
    workInProgress.expirationTime = renderExpirationTime;

    workInProgress.child = null;
    workInProgress.memoizedProps = null;
    workInProgress.memoizedState = null;
    workInProgress.updateQueue = null;

    workInProgress.dependencies = null;

    if (enableProfilerTimer) {
      // Note: We don't reset the actualTime counts. It's useful to accumulate
      // actual time across multiple render passes.
      workInProgress.selfBaseDuration = 0;
      workInProgress.treeBaseDuration = 0;
    }
  } else {
    // Reset to the cloned values that createWorkInProgress would've.
    workInProgress.childExpirationTime = current.childExpirationTime;
    workInProgress.expirationTime = current.expirationTime;

    workInProgress.child = current.child;
    workInProgress.memoizedProps = current.memoizedProps;
    workInProgress.memoizedState = current.memoizedState;
    workInProgress.updateQueue = current.updateQueue;

    // Clone the dependencies object. This is mutated during the render phase, so
    // it cannot be shared with the current fiber.
    const currentDependencies = current.dependencies;
    workInProgress.dependencies =
      currentDependencies === null
        ? null
        : {
            expirationTime: currentDependencies.expirationTime,
            firstContext: currentDependencies.firstContext,
            responders: currentDependencies.responders,
          };

    if (enableProfilerTimer) {
      // Note: We don't reset the actualTime counts. It's useful to accumulate
      // actual time across multiple render passes.
      workInProgress.selfBaseDuration = current.selfBaseDuration;
      workInProgress.treeBaseDuration = current.treeBaseDuration;
    }
  }

  return workInProgress;
}

export function createHostRootFiber(tag: RootTag): Fiber {
  let mode;
  if (tag === ConcurrentRoot) {
    mode = ConcurrentMode | BatchedMode | StrictMode;
  } else if (tag === BatchedRoot) {
    mode = BatchedMode | StrictMode;
  } else {
    mode = NoMode;
  }

  if (enableProfilerTimer && isDevToolsPresent) {
    // Always collect profile timings when DevTools are present.
    // This enables DevTools to start capturing timing at any point–
    // Without some nodes in the tree having empty base times.
    mode |= ProfileMode;
  }

  return createFiber(HostRoot, null, null, mode);
}

export function createFiberFromTypeAndProps(
  type: any, // React$ElementType
  key: null | string,
  pendingProps: any,
  owner: null | Fiber,
  mode: TypeOfMode,
  expirationTime: ExpirationTime,
): Fiber {
  let fiber;

  let fiberTag = IndeterminateComponent;
  // The resolved type is set if we know what the final type will be. I.e. it's not lazy.
  let resolvedType = type;
  if (typeof type === 'function') {
    if (shouldConstruct(type)) {
      fiberTag = ClassComponent;
    }
  } else if (typeof type === 'string') {
    fiberTag = HostComponent;
  } else {
    getTag: switch (type) {
      case REACT_FRAGMENT_TYPE:
        return createFiberFromFragment(
          pendingProps.children,
          mode,
          expirationTime,
          key,
        );
      case REACT_CONCURRENT_MODE_TYPE:
        fiberTag = Mode;
        mode |= ConcurrentMode | BatchedMode | StrictMode;
        break;
      case REACT_STRICT_MODE_TYPE:
        fiberTag = Mode;
        mode |= StrictMode;
        break;
      case REACT_PROFILER_TYPE:
        return createFiberFromProfiler(pendingProps, mode, expirationTime, key);
      case REACT_SUSPENSE_TYPE:
        return createFiberFromSuspense(pendingProps, mode, expirationTime, key);
      case REACT_SUSPENSE_LIST_TYPE:
        return createFiberFromSuspenseList(
          pendingProps,
          mode,
          expirationTime,
          key,
        );
      default: {
        if (typeof type === 'object' && type !== null) {
          switch (type.$$typeof) {
            case REACT_PROVIDER_TYPE:
              fiberTag = ContextProvider;
              break getTag;
            case REACT_CONTEXT_TYPE:
              // This is a consumer
              fiberTag = ContextConsumer;
              break getTag;
            case REACT_FORWARD_REF_TYPE:
              fiberTag = ForwardRef;
              break getTag;
            case REACT_MEMO_TYPE:
              fiberTag = MemoComponent;
              break getTag;
            case REACT_LAZY_TYPE:
              fiberTag = LazyComponent;
              resolvedType = null;
              break getTag;
            case REACT_FUNDAMENTAL_TYPE:
              if (enableFundamentalAPI) {
                return createFiberFromFundamental(
                  type,
                  pendingProps,
                  mode,
                  expirationTime,
                  key,
                );
              }
              break;
          }
        }
      }
    }
  }

  fiber = createFiber(fiberTag, pendingProps, key, mode);
  fiber.elementType = type;
  fiber.type = resolvedType;
  fiber.expirationTime = expirationTime;

  return fiber;
}

export function createFiberFromElement(
  element: ReactElement,
  mode: TypeOfMode,
  expirationTime: ExpirationTime,
): Fiber {
  let owner = null;
  const type = element.type;
  const key = element.key;
  const pendingProps = element.props;
  const fiber = createFiberFromTypeAndProps(
    type,
    key,
    pendingProps,
    owner,
    mode,
    expirationTime,
  );
  return fiber;
}

export function createFiberFromFragment(
  elements: ReactFragment,
  mode: TypeOfMode,
  expirationTime: ExpirationTime,
  key: null | string,
): Fiber {
  const fiber = createFiber(Fragment, elements, key, mode);
  fiber.expirationTime = expirationTime;
  return fiber;
}

export function createFiberFromFundamental(
  fundamentalComponent: ReactFundamentalComponent<any, any>,
  pendingProps: any,
  mode: TypeOfMode,
  expirationTime: ExpirationTime,
  key: null | string,
): Fiber {
  const fiber = createFiber(FundamentalComponent, pendingProps, key, mode);
  fiber.elementType = fundamentalComponent;
  fiber.type = fundamentalComponent;
  fiber.expirationTime = expirationTime;
  return fiber;
}

function createFiberFromProfiler(
  pendingProps: any,
  mode: TypeOfMode,
  expirationTime: ExpirationTime,
  key: null | string,
): Fiber {
  const fiber = createFiber(Profiler, pendingProps, key, mode | ProfileMode);
  // TODO: The Profiler fiber shouldn't have a type. It has a tag.
  fiber.elementType = REACT_PROFILER_TYPE;
  fiber.type = REACT_PROFILER_TYPE;
  fiber.expirationTime = expirationTime;

  return fiber;
}

export function createFiberFromSuspense(
  pendingProps: any,
  mode: TypeOfMode,
  expirationTime: ExpirationTime,
  key: null | string,
) {
  const fiber = createFiber(SuspenseComponent, pendingProps, key, mode);

  // TODO: The SuspenseComponent fiber shouldn't have a type. It has a tag.
  // This needs to be fixed in getComponentName so that it relies on the tag
  // instead.
  fiber.type = REACT_SUSPENSE_TYPE;
  fiber.elementType = REACT_SUSPENSE_TYPE;

  fiber.expirationTime = expirationTime;
  return fiber;
}

export function createFiberFromSuspenseList(
  pendingProps: any,
  mode: TypeOfMode,
  expirationTime: ExpirationTime,
  key: null | string,
) {
  const fiber = createFiber(SuspenseListComponent, pendingProps, key, mode);
  fiber.elementType = REACT_SUSPENSE_LIST_TYPE;
  fiber.expirationTime = expirationTime;
  return fiber;
}

export function createFiberFromText(
  content: string,
  mode: TypeOfMode,
  expirationTime: ExpirationTime,
): Fiber {
  const fiber = createFiber(HostText, content, null, mode);
  fiber.expirationTime = expirationTime;
  return fiber;
}

export function createFiberFromHostInstanceForDeletion(): Fiber {
  const fiber = createFiber(HostComponent, null, null, NoMode);
  // TODO: These should not need a type.
  fiber.elementType = 'DELETED';
  fiber.type = 'DELETED';
  return fiber;
}

export function createFiberFromDehydratedFragment(
  dehydratedNode: SuspenseInstance,
): Fiber {
  const fiber = createFiber(DehydratedFragment, null, null, NoMode);
  fiber.stateNode = dehydratedNode;
  return fiber;
}

export function createFiberFromPortal(
  portal: ReactPortal,
  mode: TypeOfMode,
  expirationTime: ExpirationTime,
): Fiber {
  const pendingProps = portal.children !== null ? portal.children : [];
  const fiber = createFiber(HostPortal, pendingProps, portal.key, mode);
  fiber.expirationTime = expirationTime;
  fiber.stateNode = {
    containerInfo: portal.containerInfo,
    pendingChildren: null, // Used by persistent updates
    implementation: portal.implementation,
  };
  return fiber;
}

// Used for stashing WIP properties to replay failed work in DEV.
export function assignFiberPropertiesInDEV(
  target: Fiber | null,
  source: Fiber,
): Fiber {
  if (target === null) {
    // This Fiber's initial properties will always be overwritten.
    // We only use a Fiber to ensure the same hidden class so DEV isn't slow.
    target = createFiber(IndeterminateComponent, null, null, NoMode);
  }

  // This is intentionally written as a list of all properties.
  // We tried to use Object.assign() instead but this is called in
  // the hottest path, and Object.assign() was too slow:
  // https://github.com/facebook/react/issues/12502
  // This code is DEV-only so size is not a concern.

  target.tag = source.tag;
  target.key = source.key;
  target.elementType = source.elementType;
  target.type = source.type;
  target.stateNode = source.stateNode;
  target.return = source.return;
  target.child = source.child;
  target.sibling = source.sibling;
  target.index = source.index;
  target.ref = source.ref;
  target.pendingProps = source.pendingProps;
  target.memoizedProps = source.memoizedProps;
  target.updateQueue = source.updateQueue;
  target.memoizedState = source.memoizedState;
  target.dependencies = source.dependencies;
  target.mode = source.mode;
  target.effectTag = source.effectTag;
  target.nextEffect = source.nextEffect;
  target.firstEffect = source.firstEffect;
  target.lastEffect = source.lastEffect;
  target.expirationTime = source.expirationTime;
  target.childExpirationTime = source.childExpirationTime;
  target.alternate = source.alternate;

  if (enableProfilerTimer) {
    target.actualDuration = source.actualDuration;
    target.actualStartTime = source.actualStartTime;
    target.selfBaseDuration = source.selfBaseDuration;
    target.treeBaseDuration = source.treeBaseDuration;
  }

  return target;
}
