export function wrapMapToPropsConstant (getConstant) {
  return (dispatch, options) => {
    const constant = getConstant(dispatch, options)
    const constantSelector = () => constant
    constantSelector.dependsOnOwnProps = false
    return constantSelector
  }
}

export function getDependsOnOwnProps (mapToProps) {
  return mapToProps.dependsOnOwnProps !== null &&
    mapToProps.dependsOnOwnProps !== undefined
    ? Boolean(mapToProps.dependsOnOwnProps)
    : mapToProps.length !== 1
}

export function wrapMapToPropsFunc (mapToProps, methodName) {
  return function initProxySelector (dispatch, { displayName }) {
    // proxy: {
    //   (stateOrDispatch, ownProps): props;
    //   dependsOnOwnProps: boolean;
    //   mapToProps(stateOrDispatch, ownProps?): props;
    // }
    const proxy = (stateOrDispatch, ownProps) => {
      return proxy.dependsOnOwnProps
        ? proxy.mapToProps(stateOrDispatch, ownProps)
        : proxy.mapToProps(stateOrDispatch)
    }

    // allow detectFactoryAndVerify to get ownProps
    proxy.dependsOnOwnProps = true

    proxy.mapToProps = (
      stateOrDispatch,
      ownProps
    ) => {
      proxy.mapToProps = mapToProps
      proxy.dependsOnOwnProps = getDependsOnOwnProps(mapToProps)
      let props = proxy(stateOrDispatch, ownProps)

      if (typeof props === 'function') {
        proxy.mapToProps = props
        proxy.dependsOnOwnProps = getDependsOnOwnProps(props)
        props = proxy(stateOrDispatch, ownProps)
      }

      return props
    }

    return proxy
  }
}
