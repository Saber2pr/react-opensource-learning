import Provider from './components/Provider'
import connectAdvanced from './components/connectAdvanced'
import { ReactReduxContext } from './components/Context'
import connect from './connect/connect'

import { useDispatch } from './hooks/useDispatch'
import { useSelector } from './hooks/useSelector'
import { useStore } from './hooks/useStore'

import { getBatch } from './utils/batch'
import shallowEqual from './utils/shallowEqual'

// 对于除ReactDOM和React Native之外的其他渲染器，请使用默认的noop批处理函数
const batch = getBatch()

export {
  Provider,
  connectAdvanced,
  ReactReduxContext,
  connect,
  batch,
  useDispatch,
  useSelector,
  useStore,
  shallowEqual
}
