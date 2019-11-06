import {
  useReducer,
  useRef,
  useEffect,
  useMemo,
  useContext
} from 'react'
import { useReduxContext as useDefaultReduxContext } from './useReduxContext'
import Subscription from '../utils/Subscription'
import { ReactReduxContext } from '../components/Context'

// 默认的比较函数
const refEquality = (a, b) => a === b

// selector:(storeState) => childState
// equalityFn: <T>(newChildState:T, oldChildState:T) => boolean
// useSelectorWithStoreAndSubscription: 
// <T>(selector: (storeState) => T, equalityFn: (newProps:T, oldProps:T) => boolean, ...) => T
// 对于Provider使用store，下层组件使用contextSub。
function useSelectorWithStoreAndSubscription (
  selector,
  equalityFn,
  store,
  contextSub
) {
  // forceUpdate
  const [, forceRender] = useReducer(s => s + 1, 0)

  const subscription = useMemo(() => new Subscription(store, contextSub), [
    store,
    contextSub
  ])

  const latestSelector = useRef() // selector的引用
  const latestSelectedState = useRef() // mapStateToProps之后得到的State的引用

  let selectedState

  // 这里和connectAdvanced中计算actualChildProps的道理一样
  if (
    selector !== latestSelector.current
  ) {
    // selector类似mapStateToProps
    selectedState = selector(store.getState())
  } else {
    // selector没变化，则使用缓存
    selectedState = latestSelectedState.current
  }

  useEffect(() => {
    latestSelector.current = selector
    latestSelectedState.current = selectedState
  })

  useEffect(() => {
    function checkForUpdates () {
      // 执行selector即mapStateToProps
      const newSelectedState = latestSelector.current(store.getState())

      // 比较新旧State即 shouldComponentUpdate
      if (equalityFn(newSelectedState, latestSelectedState.current)) {
        return // shouldComponentUpdate判断为state没变化 则放弃这次update
      }
      latestSelectedState.current = newSelectedState

      // forceUpdate
      forceRender({})

      // 说一下为什么是`force`
      // setState函数只有传入新的值才会re-render
      // 例如setState(array.reverse())，这个不会引起update，因为Array.prototype.reverse不纯
      // 这里强制传入了一个新对象，即setState({})，必定会引起update
    }

    // checkForUpdates注册到Provider::subscription
    // 为什么是Provider？请看components/Provider.js
    // 不严格的讲，也可以说是注册到store listeners里
    subscription.onStateChange = checkForUpdates
    subscription.trySubscribe()

    // 初始化selector更新一次
    checkForUpdates()

    return () => subscription.tryUnsubscribe() // 清理effect。取消订阅
  }, [store, subscription])

  return selectedState
}

// createSelectorHook: () => (selector, equalityFn) => childState
export function createSelectorHook (context = ReactReduxContext) {
  const useReduxContext =
    context === ReactReduxContext
      ? useDefaultReduxContext
      : () => useContext(context)

  // 传入mapStateToProps函数和一个equal函数
  // useSelector: <T>(selector: (storeState) => T, equalityFn: (newProps:T, oldProps:T) => boolean) => T
  return function useSelector (selector, equalityFn = refEquality) {

    const { store, subscription: contextSub } = useReduxContext()

    // useSelectorWithStoreAndSubscription: 
    // <T>(selector: (storeState) => T, equalityFn: (newProps:T, oldProps:T) => boolean, ...) => T
    return useSelectorWithStoreAndSubscription(
      selector,
      equalityFn,
      store,
      contextSub
    )
  }
}

// useSelector干了什么？
// 内部在store上注册了监听器
// 当Store::state变化时，组件会checkForUpdates，利用equalityFn判断是否更新
// 两个feature:
// 1. 订阅Store，当state变化时，自动mapState，将childState渲染到视图上
// 2. equalityFn等效于shouldComponentUpdate
// 不足，没有对selector函数做memorize优化
// 可以利用useCallback优化selector吗？
// 不能。selector的入参是Store::State，既然使用了react-redux就尽量不要访问store
// 而useCallback需要deps，即Store::State，这里没有办法直接拿到。
// 解决方案，使用reselect对selector做memorize处理

// default useSelector: (selector, equalityFn) => childState
export const useSelector = createSelectorHook()
