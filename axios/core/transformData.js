'use strict';

var utils = require('./../utils');

module.exports = function transformData (data, headers, fns) {
  utils.forEach(fns, fn => {
    data = fn(data, headers)
  });

  //return fns.reduce((acc, fn) => fn(acc, headers), data)

  return data;
};
