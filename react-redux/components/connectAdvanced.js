// version 7.1.0

import hoistStatics from 'hoist-non-react-statics'
import React, {
  useContext,
  useMemo,
  useEffect,
  useRef,
  useReducer
} from 'react'
import { isContextConsumer } from 'react-is'
import Subscription from '../utils/Subscription'

// 默认的一个空的context
import { ReactReduxContext } from './Context'

// 用于forceUpdate的reducer
// action: {
//   type: 'STORE_UPDATED'
//   payload: {
//     latestStoreState: any;
//     error: Error;
//   }
// }
function storeStateUpdatesReducer (state, action) {
  const [, updateCount] = state
  return [action.payload, updateCount + 1]
}

// connectAdvanced: (selectorFactory, options) => WrappedComponent => React.FC
export default function connectAdvanced (
  selectorFactory,
  {
    shouldHandleStateChanges = true, // 确定此组件是否为静态组件(纯展示组件)，即不订阅store
    forwardRef = false,
    context = ReactReduxContext,
    ...connectOptions
  } = {}
) {
  // context: {
  //   store: any;
  //   subscription: Subscription;
  // }
  const Context = context

  // WrappedComponent: 被装饰组件target
  // wrapWithConnect: WrappedComponent => React.FC
  return function wrapWithConnect (WrappedComponent) {
    const selectorFactoryOptions = {
      ...connectOptions,
      shouldHandleStateChanges,
      WrappedComponent
    }

    const { pure } = connectOptions

    // createChildSelector执行后返回一个selector
    // createChildSelector: store => (nextState, nextOwnProps) => Props
    function createChildSelector (store) {
      // selectorFactory执行后返回一个selector
      // selectorFactory: (dispatch, ...options) => (nextState, nextOwnProps) => Props
      return selectorFactory(store.dispatch, selectorFactoryOptions)
      // selector传入stateProps, dispatchProps执行mapXXXToProps会返回新的props
    }

    // 装饰器返回的新的组件
    // ConnectFunction: React.FC
    function ConnectFunction (props) {
      // 主要是解构props，从中分离出context和ref
      const [propsContext, forwardedRef, wrapperProps] = useMemo(() => {
        const { forwardedRef, ...wrapperProps } = props
        return [props.context, forwardedRef, wrapperProps]
      }, [props])

      // 判断有无从props传下来的context
      // 如果没有就用ReactReduxContext
      const ContextToUse = useMemo(() => {
        return propsContext &&
          propsContext.Consumer &&
          isContextConsumer(<propsContext.Consumer />)
          ? propsContext
          : Context
      }, [propsContext, Context])

      // 从Context中取出值
      const contextValue = useContext(ContextToUse)

      // 判断props中是否有store
      const didStoreComeFromProps = Boolean(props.store)
      // 优先使用props中的store而不是context中的store
      const store = props.store || contextValue.store

      // childPropsSelector: (stateProps, dispatchProps) => nextOwnProps
      const childPropsSelector = useMemo(() => createChildSelector(store), [store])

      // subscription: Subscription, notifyNestedSubs: () => void
      const [subscription, notifyNestedSubs] = useMemo(() => {
        if (!shouldHandleStateChanges) return [null, null]
        // Store迁移到ListenerCollection
        // store -> subscription
        const subscription = new Subscription(
          store,
          didStoreComeFromProps ? null : contextValue.subscription
        )
        // notifyNestedSubs即发布订阅函数(dispatcher)
        const notifyNestedSubs = subscription.notifyNestedSubs.bind(subscription)
        return [subscription, notifyNestedSubs]
      }, [store, didStoreComeFromProps, contextValue])

      // 拷贝后的context
      const overriddenContextValue = useMemo(() => {
        // 如果store来自props就不拷贝
        if (didStoreComeFromProps) return contextValue
        return { ...contextValue, subscription } // 拷贝contextValue
      }, [didStoreComeFromProps, contextValue, subscription])

      // 这里用useReducer创建了一个forceDispatch
      // previousStateUpdateResult: {
      //   latestStoreState: any;
      //   error: Error;
      // }
      const [
        [previousStateUpdateResult],
        forceComponentUpdateDispatch
      ] = useReducer(storeStateUpdatesReducer, [], () => [null, 0])

      // 检查上次mapXXXToProps是否出错，如果出错则向上传播异常
      if (previousStateUpdateResult && previousStateUpdateResult.error) {
        throw previousStateUpdateResult.error
      }

      const lastChildProps = useRef() // 记录上次执行了mapXXXToProps后的Props
      const lastWrapperProps = useRef(wrapperProps) // Connect组件的props记录
      const childPropsFromStoreUpdate = useRef() // 记录newChildProps，store.dispatch执行会更新此值
      const renderIsScheduled = useRef(false) // 记录组件更新处理状态

      // 执行了mapXXXToProps后的Props
      const actualChildProps = useMemo(() => {
        // 如果Connect组件接受的Props没变化(浅比较)，则直接返回上次store.dispatch执行后的Props
        if (
          childPropsFromStoreUpdate.current &&
          wrapperProps === lastWrapperProps.current
        ) {
          return childPropsFromStoreUpdate.current // 上次store.dispatch执行后的Props
        }
        // 这里提到了在执行mapXXXToProps时(与组件渲染同步执行)，读取了Store中的状态.
        // 这可能在并发模式下出错（即脏读State），但是mapXXXToProps执行需要先拿到Store中的State。
        // 所以尽量保证mapXXXToProps为纯函数。
        // childPropsSelector: (nextState, nextOwnProps) => Props
        return childPropsSelector(store.getState(), wrapperProps)
      }, [store, previousStateUpdateResult, wrapperProps])

      // 初始化refs和subscription
      useEffect(() => {
        lastWrapperProps.current = wrapperProps
        lastChildProps.current = actualChildProps
        renderIsScheduled.current = false

        if (childPropsFromStoreUpdate.current) {
          childPropsFromStoreUpdate.current = null
          // 第一次广播事件，触发checkForUpdates
          notifyNestedSubs()
        }
      })

      // useEffect(() => store.subscribe(checkForUpdates))，组件订阅更新
      useEffect(() => {
        if (!shouldHandleStateChanges) return // 组件不监听store state变化
        let didUnsubscribe = false
        let lastThrownError = null // 保存在mapXXXToProps执行中出现的错误

        // store dispatch时，会触发checkForUpdates。checkForUpdates会执行setState
        const checkForUpdates = () => {
          if (didUnsubscribe) return // 组件unMount后didUnsubscribe变为false(即取消订阅后)
          const latestStoreState = store.getState()
          let newChildProps, error
          try {
            // childPropsSelector: (nextState, nextOwnProps) => Props
            newChildProps = childPropsSelector(latestStoreState, lastWrapperProps.current)
          } catch (e) {
            error = e // 收集错误存到previousStateUpdateResult里
            lastThrownError = e
          }

          if (!error) lastThrownError = null

          // 判断新旧props，避免re-render
          if (newChildProps === lastChildProps.current) {
            // 如果新旧props相同，但是组件没有更新，则再执行一次checkForUpdates
            // 是动态改变shouldHandleStateChanges引起的情况
            if (!renderIsScheduled.current) notifyNestedSubs() // 广播事件，触发onStateChange
          } else {
            lastChildProps.current = newChildProps
            // 记录newChildProps到ref，用于新旧props比较
            childPropsFromStoreUpdate.current = newChildProps
            renderIsScheduled.current = true // 组件已更新

            // ReactDispatcher更新，即useReducer的dispatch，就是个forceUpdate
            forceComponentUpdateDispatch({
              type: 'STORE_UPDATED',
              payload: {
                latestStoreState, // 记录上次store中的state
                error // 保存error信息
              }
            })
          }
        }

        // 这里就是store.subscribe
        // onStateChange在subscription.trySubscribe时
        // 会执行store.subscribe(() => subscription.onStateChange())
        // 即store.subscribe(checkForUpdates)
        subscription.onStateChange = checkForUpdates
        subscription.trySubscribe()

        checkForUpdates() // 初始化更新

        const unsubscribeWrapper = () => {
          didUnsubscribe = true
          subscription.tryUnsubscribe()
          // 主要是放置漏掉组件此时处于unMount状态出现mapXXXToProps执行错误
          // 例如条件渲染，未显示的组件出现mapXXXToProps错误
          // mapXXXToProps中出现的错误会在清理Effect时抛出
          if (lastThrownError) throw lastThrownError
        }
        // 清理订阅者，即清理Effect
        return unsubscribeWrapper
      }, [store, subscription, childPropsSelector])

      // mapXXXToProps后的WrappedComponent
      // 转发从context中传下来的ref
      // WrappedComponent一定是ClassComponent，这里ref={forwardedRef}有什么意义呢？应该使用React.forwardRef？
      /** @see {https://zh-hans.reactjs.org/docs/forwarding-refs.html#forwarding-refs-to-dom-components} **/
      // 应该是预备转发。如果上层使用了React.forwardRef这里的ref就有值（forwardRef）透传下来，如果上层没用React.forwardRef，这个ref属性的值就是undefined。
      const renderedWrappedComponent = useMemo(
        () => <WrappedComponent {...actualChildProps} ref={forwardedRef} />,
        [forwardedRef, WrappedComponent, actualChildProps]
      )

      // 给WrappedComponent包裹一层新的Store Context Provider
      const renderedChild = useMemo(() => {
        if (shouldHandleStateChanges) {
          return (
            <ContextToUse.Provider value={overriddenContextValue}>
              {renderedWrappedComponent}
            </ContextToUse.Provider>
          )
        }

        return renderedWrappedComponent
      }, [ContextToUse, renderedWrappedComponent, overriddenContextValue])

      return renderedChild
    } // ConnectFunction

    // memo优化ConnectFunction，当props变化时才re-render
    const Connect = pure ? React.memo(ConnectFunction) : ConnectFunction

    // forwardRef用在函数组件上，将ref转发到函数组件下的Host组件
    if (forwardRef) {
      const forwarded = React.forwardRef((props, ref) => <Connect {...props} forwardedRef={ref} />)
      return hoistStatics(forwarded, WrappedComponent)
    }

    // 将WrappedComponent及其父类上的属性拷贝属性到Connect
    return hoistStatics(Connect, WrappedComponent)
  } // wrapWithConnect
}
