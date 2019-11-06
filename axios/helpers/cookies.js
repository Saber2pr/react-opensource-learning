'use strict';

var utils = require('./../utils');

//标准浏览器环境支持document.cookie
const standardBrowserEnv = {
  write (name, value, expires, path, domain, secure) {
    const cookie = []

    cookie.push(name + '=' + encodeURIComponent(value))

    if (utils.isNumber(expires)) {
      cookie.push('expires=' + new Date(expires).toGMTString())
    }

    if (utils.isString(path)) {
      cookie.push('path=' + path)
    }

    if (utils.isString(domain)) {
      cookie.push('domain=' + domain)
    }

    if (secure === true) {
      cookie.push('secure')
    }

    document.cookie = cookie.join('; ')
  },

  read (name) {
    const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'))
    return match ? decodeURIComponent(match[3]) : null
  },

  remove (name) {
    this.write(name, '', Date.now() - 86400000)
  }
};

// 非标准浏览器环境（Web worker，react-native）不支持cookie
const nonStandardBrowserEnv = {
  write () { },
  read () { },
  remove () { }
};

module.exports = utils.isStandardBrowserEnv() ? standardBrowserEnv : nonStandardBrowserEnv
