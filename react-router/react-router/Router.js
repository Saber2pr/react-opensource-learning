import React from "react"

import RouterContext from "./RouterContext"

// Router干了什么
// 监听history，向子组件推送当前location

class Router extends React.Component {
  // 和使用matchPath得到的结果一样，这里只是快速匹配
  // 对于root节点的路由匹配
  static computeRootMatch(pathname) {
    return { path: "/", url: "/", params: {}, isExact: pathname === "/" }
  }

  constructor(props) {
    super(props)

    this.state = {
      location: props.history.location
    }

    // 这有点hack.在构造函数这里我们需要监听一下location的变化，
    // 以防在初始化渲染时有<Redirect>重定向。
    // 我们可能会在<Router>挂载之前获取新位置。 
    this._isMounted = false
    this._pendingLocation = null

    // 如果上层使用了StaticRouter，则跳过监听器初始化
    if (!props.staticContext) {
      // 观察路由事件
      this.unlisten = props.history.listen(location => {
        if (this._isMounted) { //如果Router Mounted
          this.setState({ location })
        } else {
          // 否则设置待定路由
          // 等到Router Mounted再update
          this._pendingLocation = location
        }
      })
    }

    // 只要路由变化，Router组件就会调用ReactDispatcher(setState)，通知它的子组件
    // 将location传递下去
    // Router不做匹配，只负责订阅history和推送消息
  }

  // Router Mounted，update待定路由
  componentDidMount() {
    this._isMounted = true

    if (this._pendingLocation) {
      this.setState({ location: this._pendingLocation })
    }
  }

  // Router卸载，移除history监听器
  componentWillUnmount() {
    if (this.unlisten) this.unlisten()
  }

  render() {
    return (
      <RouterContext.Provider
        children={this.props.children || null}
        value={{
          history: this.props.history,
          location: this.state.location, // history.location
          // match:与根路由匹配结果
          match: Router.computeRootMatch(this.state.location.pathname),
          staticContext: this.props.staticContext
        }}
      />
    )
  }
}

export default Router
