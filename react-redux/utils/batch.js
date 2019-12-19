// 这个util主要做batch的接口，默认是个noop

// /默认为只运行回调的虚拟“批处理”实现
function defaultNoopBatch (callback) {
  callback()
}

let batch = defaultNoopBatch

// batch setter
export const setBatch = newBatch => (batch = newBatch)

// batch getter
export const getBatch = () => batch
