// 不纯的selector
// 就直接重复执行mapXXXToProps
// 因为不纯的函数没法memorize优化
export function impureFinalPropsSelectorFactory (
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  dispatch
) {
  return (state, ownProps) => mergeProps(
    mapStateToProps(state, ownProps),
    mapDispatchToProps(dispatch, ownProps),
    ownProps
  )
}

// 纯的selector，使用memorize优化
// pureFinalPropsSelectorFactory: 
// (mapStateToProps, mapDispatchToProps, mergeProps, dispatch, ...areEquals) => 
// (nextState, nextOwnProps) => Props
export function pureFinalPropsSelectorFactory (
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  dispatch,
  { areStatesEqual, areOwnPropsEqual, areStatePropsEqual }
) {
  let hasRunAtLeastOnce = false
  let state
  let ownProps
  let stateProps
  let dispatchProps
  let mergedProps

  // handleFirstCall: (state, props) => props
  // 调用mapXXXToProps把dispatch和state都map到props里
  function handleFirstCall (firstState, firstOwnProps) {
    state = firstState
    ownProps = firstOwnProps
    stateProps = mapStateToProps(state, ownProps)
    dispatchProps = mapDispatchToProps(dispatch, ownProps)
    mergedProps = mergeProps(stateProps, dispatchProps, ownProps)
    hasRunAtLeastOnce = true
    return mergedProps
  }

  function handleNewPropsAndNewState () {
    stateProps = mapStateToProps(state, ownProps)

    if (mapDispatchToProps.dependsOnOwnProps)
      dispatchProps = mapDispatchToProps(dispatch, ownProps)

    mergedProps = mergeProps(stateProps, dispatchProps, ownProps)
    return mergedProps
  }

  function handleNewProps () {
    if (mapStateToProps.dependsOnOwnProps)
      stateProps = mapStateToProps(state, ownProps)

    if (mapDispatchToProps.dependsOnOwnProps)
      dispatchProps = mapDispatchToProps(dispatch, ownProps)

    mergedProps = mergeProps(stateProps, dispatchProps, ownProps)
    return mergedProps
  }

  function handleNewState () {
    const nextStateProps = mapStateToProps(state, ownProps)
    const statePropsChanged = !areStatePropsEqual(nextStateProps, stateProps)
    stateProps = nextStateProps

    if (statePropsChanged)
      mergedProps = mergeProps(stateProps, dispatchProps, ownProps)

    return mergedProps
  }

  function handleSubsequentCalls (nextState, nextOwnProps) {
    const propsChanged = !areOwnPropsEqual(nextOwnProps, ownProps)
    const stateChanged = !areStatesEqual(nextState, state)
    state = nextState
    ownProps = nextOwnProps

    if (propsChanged && stateChanged) return handleNewPropsAndNewState()
    if (propsChanged) return handleNewProps()
    if (stateChanged) return handleNewState()
    return mergedProps
  }

  // selector: (nextState, nextOwnProps) => Props
  return (nextState, nextOwnProps) => {
    return hasRunAtLeastOnce // hasRunAtLeastOnce = false
      // handleSubsequentCalls: (nextState, nextOwnProps) => Props
      ? handleSubsequentCalls(nextState, nextOwnProps)
      // handleFirstCall: (nextState, nextOwnProps) => Props
      : handleFirstCall(nextState, nextOwnProps)
  }
}

// finalPropsSelectorFactory: (dispatch, ...options) => 
// (nextState, nextOwnProps) => Props
export default function finalPropsSelectorFactory (
  dispatch,
  { initMapStateToProps, initMapDispatchToProps, initMergeProps, ...options }
) {
  const mapStateToProps = initMapStateToProps(dispatch, options)
  const mapDispatchToProps = initMapDispatchToProps(dispatch, options)
  const mergeProps = initMergeProps(dispatch, options)

  const selectorFactory = options.pure
    ? pureFinalPropsSelectorFactory
    : impureFinalPropsSelectorFactory

  // selectorFactory:
  // (mapStateToProps, mapDispatchToProps, mergeProps, dispatch, ...areEquals) => 
  // (nextState, nextOwnProps) => Props
  return selectorFactory(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps,
    dispatch,
    options
  )
}
