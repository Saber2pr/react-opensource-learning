import React from "react"
import { TouchableHighlight } from "react-native"

import { __RouterContext as RouterContext } from "react-router"

class Link extends React.Component {
  static defaultProps = {
    component: TouchableHighlight,
    replace: false
  }

  handlePress = (event, history) => {
    if (this.props.onPress) this.props.onPress(event)

    if (!event.defaultPrevented) {
      const { to, replace } = this.props

      if (replace) {
        history.replace(to)
      } else {
        history.push(to)
      }
    }
  }

  render () {
    const { component: Component, to, replace, ...rest } = this.props

    return (
      <RouterContext.Consumer>
        {context => (
          <Component
            {...rest}
            onPress={event => this.handlePress(event, context.history)}
          />
        )}
      </RouterContext.Consumer>
    )
  }
}

export default Link
