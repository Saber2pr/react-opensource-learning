// 这个库用来对mapXXXToProps函数做memorize优化

const defaultEqualityCheck = (a, b) => a === b

// 两个数组之间的diff
// 利用比较函数equalityCheck对比prev和next
// equalityCheck: (prev: any, next: any) => boolean
// areArgumentsShallowlyEqual: (equalityCheck, prevs: any[], nexts: any[]) => boolean
function areArgumentsShallowlyEqual(equalityCheck, prev, next) {
  if (prev === null || next === null || prev.length !== next.length) {
    return false
  }

  const length = prev.length
  for (let i = 0; i < length; i++) {
    if (!equalityCheck(prev[i], next[i])) {
      return false
    }
  }

  return true
}

// 对函数func进行memorize优化
// 利用equalityCheck对入参做缓存验证
// defaultMemoize: (func, equalityCheck) => (...args) => Result
export function defaultMemoize(func, equalityCheck = defaultEqualityCheck) {
  let lastArgs /**: any[] **/ = null
  let lastResult /**: any[] **/ = null
  return (...args) => {
    // 利用比较函数equalityCheck对比lastArgs和args(两个数组)
    if (!areArgumentsShallowlyEqual(equalityCheck, lastArgs, args)) {
      // 如果不一致，则重新执行func
      lastResult = func(args)
    }

    // 如果lastArgs和args一致
    lastArgs = args

    // 返回闭包中的缓存
    return lastResult
  }
}

// 平坦化处理
// 如果是([inputSelectors], resultFunc)这样的rest就是[[inputSelectors], resultFunc]
// pop之后变成[[inputSelectors]]，然后getDependencies变成[inputSelectors]
// funcs: [inputSelectors] | [[inputSelectors]]
// getDependencies: funcs => InputSelector[]
const getDependencies = funcs => Array.isArray(funcs[0]) ? funcs[0] : funcs

// memoize: (func, equalityCheck) => (...args) => Result
// createSelectorCreator: (memorize, ...memoizeOptions) => 
//   (...inputSelectors, resultFunc) => State => Result
export function createSelectorCreator(memoize, ...memoizeOptions) {
  // funcs: [[inputSelectors], resultFunc]
  // funcs: [...inputSelectors, resultFunc]
  return (...funcs) => {
    let recomputations = 0

    // 拿到funcs中最后一个函数
    const resultFunc = funcs.pop()

    // funcs: [inputSelectors] | [[inputSelectors]]
    // dependencies: InputSelector[] = funcs
    const dependencies = getDependencies(funcs)

    // 得到resultFunc经过memorize优化后的版本
    const memoizedResultFunc = memoize(
        (...args) => {
        recomputations++
        return resultFunc(...args)
      },
      ...memoizeOptions
    )

    // 每个inputSelector的入参都是相同的
    // 所以将所有inputSelectors的入参统一起来做memorize优化
    const selector = memoize((...args) => {
      const params = []
      const length = dependencies.length

      for (let i = 0; i < length; i++) {
        // 遍历每个inputSelector执行
        // 并将结果收集到params里
        params.push(dependencies[i](...args))
      }

      // 将收集到的params传给resultFunc执行
      // 返回resultFunc执行后的结果
      return memoizedResultFunc(...params)
    })

    selector.resultFunc = resultFunc
    selector.dependencies = dependencies
    selector.recomputations = () => recomputations
    selector.resetRecomputations = () => recomputations = 0
    return selector
  }
}

// createSelector: (...inputSelectors, resultFunc) => State => Result
export const createSelector = createSelectorCreator(defaultMemoize)

// createStructuredSelector对createSelector做了一次封装
// 和createSelector的区别是，不需要编写resultFunc
// createStructuredSelector将resultFunc实现为对Object.values(selectors)的compose
// createStructuredSelector: selectors => State => Result
export function createStructuredSelector(selectors, selectorCreator = createSelector) {
  // 拿到selectors所有属性作为数组
  const objectKeys = Object.keys(selectors)
  return selectorCreator(
    // 拿到selectors所有属性值的数组，相当于Object.values(selectors)
    // 不影响objectKeys
    objectKeys.map(key => selectors[key]),
    // compose selector
    (...values) => values.reduce((composition, value, index) => {
      composition[objectKeys[index]] = value
      return composition
    }, {})
  )
}
