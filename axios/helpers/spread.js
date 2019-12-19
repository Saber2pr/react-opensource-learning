'use strict';

/**
 * Syntactic sugar for invoking a function and expanding an array for arguments.
 *
 * Common use case would be to use `Function.prototype.apply`.
 *
 *  ```js
 *  function f(x, y, z) {}
 *  var args = [1, 2, 3];
 *  f.apply(null, args);
 *  ```
 *
 * With `spread` this example can be re-written.
 *
 *  ```js
 *  spread(function(x, y, z) {})([1, 2, 3]); // 你这个和 ;(function(x, y, z) {})(1, 2, 3) 是有什么区别么？
 *  ```
 *
 * @param {Function} callback
 * @returns {Function}
 */
module.exports = function spread (fn) {
  return arr => fn.apply(null, arr);
};
