function createThunkMiddleware (extraArgument) {
  // thunkMiddleware: middlewareAPI => dispatch => action => any
  return ({ dispatch, getState }) => next => action => {
    // 如果是异步action
    if (typeof action === 'function') {
      return action(dispatch, getState, extraArgument)
    }

    return next(action)
  }
}

const thunk = createThunkMiddleware()
thunk.withExtraArgument = createThunkMiddleware

export default thunk
