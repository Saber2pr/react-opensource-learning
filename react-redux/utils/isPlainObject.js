/**
 * @param {any} obj The object to inspect.
 * @returns {boolean} True if the argument appears to be a plain object.
 */
export default function isPlainObject (obj) {
  if (typeof obj !== 'object' || obj === null) return false

  let proto = Object.getPrototypeOf(obj)
  if (proto === null) return true

  // 如果当前与最顶层一致，则为平坦对象

  let baseProto = proto
  while (Object.getPrototypeOf(baseProto) !== null) {
    baseProto = Object.getPrototypeOf(baseProto)
  }

  return proto === baseProto
}
