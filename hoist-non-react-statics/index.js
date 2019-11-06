// version 3.3.0

// 这个包意思是重写一个Object.assgin专门用于React Component，在拷贝的过程中能够滤去React Component内置的静态属性。只拷贝用户定义的属性。

// react-is这个包主要用来匹配React Component上的$$typeof属性
import { ForwardRef, isMemo } from 'react-is'

// React ClassComponent上的静态属性
const REACT_STATICS = {
  childContextTypes: true,
  contextType: true,
  contextTypes: true,
  defaultProps: true,
  displayName: true,
  getDefaultProps: true,
  getDerivedStateFromError: true,
  getDerivedStateFromProps: true,
  mixins: true,
  propTypes: true,
  type: true
}

// 已知的JS Object & Function 对象内置属性
const KNOWN_STATICS = {
  name: true,
  length: true,
  prototype: true,
  caller: true,
  callee: true,
  arguments: true,
  arity: true
}

// React Component上的属性
const FORWARD_REF_STATICS = {
  '$$typeof': true,
  render: true,
  defaultProps: true,
  displayName: true,
  propTypes: true
}

// React Component上的属性
const MEMO_STATICS = {
  '$$typeof': true,
  compare: true,
  defaultProps: true,
  displayName: true,
  propTypes: true,
  type: true,
}

const TYPE_STATICS = {}
TYPE_STATICS[ForwardRef] = FORWARD_REF_STATICS

// 获取React Component对应的静态属性名集合
// getStatics: component => Object
function getStatics (component) {
  if (isMemo(component)) {
    return MEMO_STATICS
  }
  return TYPE_STATICS[component['$$typeof']] || REACT_STATICS
}

const defineProperty = Object.defineProperty
const getOwnPropertyNames = Object.getOwnPropertyNames
const getOwnPropertySymbols = Object.getOwnPropertySymbols
const getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor
const getPrototypeOf = Object.getPrototypeOf
const objectPrototype = Object.prototype

// 将sourceComponent及其父类上的属性拷贝到targetComponent上。
// 过滤JS对象内置属性，过滤React Component内置静态属性
export default function hoistNonReactStatics (targetComponent, sourceComponent, blacklist) {
  if (typeof sourceComponent !== 'string') {

    // 顺着sourceComponent的原型链将sourceComponent父类的属性也拷贝到targetComponent上
    // 因为是从class上面找，如果是class实例就不用访问原型链了
    if (objectPrototype) {
      const inheritedComponent = getPrototypeOf(sourceComponent)
      if (inheritedComponent && inheritedComponent !== objectPrototype) {
        hoistNonReactStatics(targetComponent, inheritedComponent, blacklist)
      }
    }

    // keys中存入被assgin组件的属性名集合
    let keys = getOwnPropertyNames(sourceComponent)

    // keys中存入被assgin组件上的symbol集合
    if (getOwnPropertySymbols) {
      keys = keys.concat(getOwnPropertySymbols(sourceComponent))
    }

    // 获取Component对应的属性名集合
    const targetStatics = getStatics(targetComponent)
    const sourceStatics = getStatics(sourceComponent)

    for (let i = 0; i < keys.length; ++i) {
      const key = keys[i]
      if (!KNOWN_STATICS[key] && // 过滤掉JS内置属性名
        !(blacklist && blacklist[key]) && // 过滤掉被黑名单的属性名
        !(sourceStatics && sourceStatics[key]) &&// 过滤掉sourceComponent上有的React Component内置静态属性名
        !(targetStatics && targetStatics[key])  // 过滤掉targetComponent上有的React Component内置静态属性名
      ) {
        const descriptor = getOwnPropertyDescriptor(sourceComponent, key)
        try {
          defineProperty(targetComponent, key, descriptor)
        } catch (e) { }
      } // 完成属性拷贝
    }
  }

  return targetComponent
}