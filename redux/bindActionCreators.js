function bindActionCreator (actionCreator, dispatch) {
  return (...args) => dispatch(actionCreator(args))
}

export default function bindActionCreators (actionCreators, dispatch) {
  if (typeof actionCreators === 'function') {
    return bindActionCreator(actionCreators, dispatch)
  }

  return Object.keys(actionCreators).reduce((boundActionCreators, key) => {
    boundActionCreators[key] = bindActionCreator(actionCreator, dispatch)
    return boundActionCreators
  }, {})
}

/**
 * 例如
 * ```js
 * const TodoActionCreators = {
 *   addTodo: text => ({type: 'ADD_TODO', text}),
 *   removeTodo: text => ({type: 'REMOVE_TODO', text})
 * } as const
 *
 * boundActionCreators = bindActionCreators(TodoActionCreators, store.dispatch)
 * ```
 * bindActionCreators遍历TodoActionCreators中每个actionCreator，将它们封装了一层。
 * bindActionCreator返回了新的actionCreator，接受参数自动dispatch。
 */