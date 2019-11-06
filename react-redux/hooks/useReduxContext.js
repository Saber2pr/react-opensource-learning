import { useContext } from 'react'
import { ReactReduxContext } from '../components/Context'

export function useReduxContext () {
  const contextValue = useContext(ReactReduxContext)
  return contextValue
}
