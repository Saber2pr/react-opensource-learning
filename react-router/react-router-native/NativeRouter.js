import React from "react"
import { Alert } from "react-native"
import { MemoryRouter } from "react-router"

/**
 * The public API for a <Router> designed for React Native. Gets
 * user confirmations via Alert by default.
 */
function NativeRouter (props) {
  return <MemoryRouter {...props} />
}

NativeRouter.defaultProps = {
  getUserConfirmation: (message, callback) => {
    Alert.alert("Confirm", message, [
      { text: "Cancel", onPress: () => callback(false) },
      { text: "OK", onPress: () => callback(true) }
    ])
  }
}

export default NativeRouter
