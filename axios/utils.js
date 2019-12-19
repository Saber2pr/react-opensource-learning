'use strict';

var bind = require('./helpers/bind');
var isBuffer = require('is-buffer');

/*global toString:true*/

// utils是一个非特定于axios的通用辅助函数库（果然大佬都喜欢造底层库）

var toString = Object.prototype.toString;

const isArray = val => toString.call(val) === '[object Array]'
const isArrayBuffer = val => toString.call(val) === '[object ArrayBuffer]'
const isString = (val) => typeof val === 'string';
const isNumber = (val) => typeof val === 'number';
const isUndefined = (val) => typeof val === 'undefined';
const isObject = (val) => val !== null && typeof val === 'object';
const isDate = (val) => toString.call(val) === '[object Date]';
const isFile = (val) => toString.call(val) === '[object File]';
const isBlob = (val) => toString.call(val) === '[object Blob]';
const isFunction = (val) => toString.call(val) === '[object Function]';
const isStream = (val) => isObject(val) && isFunction(val.pipe);
const isURLSearchParams = (val) => typeof URLSearchParams !== 'undefined' && val instanceof URLSearchParams;
const trim = (str) => str.replace(/^\s*/, '').replace(/\s*$/, '');

// 确定值是否为FormData类型
const isFormData = val => (typeof FormData !== 'undefined') && (val instanceof FormData)

function isArrayBufferView (val) {
  var result;
  if ((typeof ArrayBuffer !== 'undefined') && (ArrayBuffer.isView)) {
    result = ArrayBuffer.isView(val);
  } else {
    result = (val) && (val.buffer) && (val.buffer instanceof ArrayBuffer);
  }
  return result;
}

function isStandardBrowserEnv () {
  if (typeof navigator !== 'undefined' && (navigator.product === 'ReactNative' ||
    navigator.product === 'NativeScript' ||
    navigator.product === 'NS')) {
    return false;
  }
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined'
  );
}

function forEach (obj, fn) {
  if (obj === null || typeof obj === 'undefined') {
    return;
  }

  if (typeof obj !== 'object') {
    obj = [obj];
  }

  if (isArray(obj)) {
    for (var i = 0, l = obj.length; i < l; i++) {
      fn.call(null, obj[i], i, obj);
    }
  } else {
    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        fn.call(null, obj[key], key, obj);
      }
    }
  }
}

function merge (...objs) {
  const result = {};

  function assignValue (val, key) {
    if (typeof result[key] === 'object' && typeof val === 'object') {
      result[key] = merge(result[key], val);

    } else {
      result[key] = val;
    }
  }

  for (let i = 0, l = objs.length; i < l; i++) {
    forEach(objs[i], assignValue);
  }

  return result;
}

function deepMerge (...objs) {
  const result = {};

  function assignValue (val, key) {
    if (typeof result[key] === 'object' && typeof val === 'object') {
      result[key] = deepMerge(result[key], val);

    } else if (typeof val === 'object') {
      result[key] = deepMerge({}, val);

    } else {
      result[key] = val;
    }
  }

  for (let i = 0, l = objs.length; i < l; i++) {
    forEach(objs[i], assignValue);
  }
  return result;
}

// 我只能说这叫拷贝，不叫继承
function extend (a, b, thisArg) {
  forEach(b, function assignValue (val, key) {
    if (thisArg && typeof val === 'function') {
      a[key] = val.bind(thisArg);

    } else {
      a[key] = val;
    }
  });
  return a;
}

module.exports = {
  isArray,
  isArrayBuffer,
  isBuffer,
  isFormData,
  isArrayBufferView,
  isString,
  isNumber,
  isObject,
  isUndefined,
  isDate,
  isFile,
  isBlob,
  isFunction,
  isStream,
  isURLSearchParams,
  isStandardBrowserEnv,
  forEach,
  merge,
  deepMerge,
  extend,
  trim
};
