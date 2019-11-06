import { FORWARD_REF_KEY } from "./forwardRef"
import RefForwarder from "./RefForwarder"
import warning from "fbjs/lib/warning"

export default function getRef(refObject) {
  if (!refObject) {
    return null
  }

  let ref = refObject

  if (Object.keys(ref).length === 1) {
    if (ref.hasOwnProperty("current")) {
      ref = ref.current
    } else if (ref.hasOwnProperty("value")) {
      ref = ref.value
    }
  }

  //获取polyfilled forwardedRef（如果存在）
  if (ref instanceof RefForwarder) {
    ref = ref.getRef()
  }

  return ref
}
