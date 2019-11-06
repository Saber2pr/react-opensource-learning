import connectAdvanced from '../components/connectAdvanced'
import shallowEqual from '../utils/shallowEqual'

// mergePropsFactories、mapDispatchToPropsFactories、mapStateToPropsFactories这三个不用看
import mapDispatchToPropsFactories from './mapDispatchToProps'
import mapStateToPropsFactories from './mapStateToProps'
import mergePropsFactories from './mergeProps'

import selectorFactory from './selectorFactory'

function match (arg, factories, name) {
  for (let i = factories.length - 1; i >= 0; i--) {
    const result = factories[i](arg)
    if (result) return result
  }
}

const areStatesEqual = (a, b) => a === b
const areOwnPropsEqual = shallowEqual
const areStatePropsEqual = shallowEqual
const areMergedPropsEqual = shallowEqual

// createConnect:() => (mapStateToProps, mapDispatchToProps, mergeProps) => WrappedComponent => React.FC
export function createConnect () {
  // connect: (mapStateToProps, mapDispatchToProps, mergeProps) => WrappedComponent => React.FC
  return function connect (
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ) {
    const initMapStateToProps = match(
      mapStateToProps,
      mapStateToPropsFactories,
      'mapStateToProps'
    )
    const initMapDispatchToProps = match(
      mapDispatchToProps,
      mapDispatchToPropsFactories,
      'mapDispatchToProps'
    )
    const initMergeProps = match(mergeProps, mergePropsFactories, 'mergeProps')

    // selectorFactory: (dispatch, ...options) => (nextState, nextOwnProps) => Props
    // connectAdvanced: (selectorFactory, options) => WrappedComponent => React.FC
    return connectAdvanced(selectorFactory, {
      methodName: 'connect',

      getDisplayName: name => `Connect(${name})`,
      shouldHandleStateChanges: Boolean(mapStateToProps),

      initMapStateToProps,
      initMapDispatchToProps,
      initMergeProps,

      pure: true,

      areStatesEqual,
      areOwnPropsEqual,
      areStatePropsEqual,
      areMergedPropsEqual
    })
  }
}

// default: (mapStateToProps, mapDispatchToProps, mergeProps) => WrappedComponent => React.FC
export default createConnect()
