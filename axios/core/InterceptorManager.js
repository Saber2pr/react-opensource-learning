'use strict';

var utils = require('./../utils')

/**
 * handle {
 *   fulfilled
 *   rejected
 * }
 * 
 * InterceptorManager {
 *   handlers: handle[]
 *   use: (fulfilled, rejected) => id
 *   eject: id => void
 *   forEach: (cb: handle => void) => void
 * }
 */
function InterceptorManager () {
  this.handlers = []
}

// 添加一个新的拦截器到堆栈
InterceptorManager.prototype.use = (fulfilled, rejected) => {
  this.handlers.push({
    fulfilled: fulfilled,
    rejected: rejected
  })

  return this.handlers.length - 1
}

// 从堆栈中删除拦截器
InterceptorManager.prototype.eject = id => {
  if (this.handlers[id]) {
    this.handlers[id] = null
  }
}

// 迭代所有已注册的拦截器
InterceptorManager.prototype.forEach = fn => utils.forEach(this.handlers, h => h && fn(h))

module.exports = InterceptorManager;
