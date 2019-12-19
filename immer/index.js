import { Immer } from "./immer"

const immer = new Immer()

export const produce = immer.produce

export default produce

export const produceWithPatches = immer.produceWithPatches.bind(immer)

export const setAutoFreeze = immer.setAutoFreeze.bind(immer)

export const setUseProxies = immer.setUseProxies.bind(immer)

export const applyPatches = immer.applyPatches.bind(immer)

export const createDraft = immer.createDraft.bind(immer)

export const finishDraft = immer.finishDraft.bind(immer)

export {
  original,
  isDraft,
  isDraftable,
  NOTHING as nothing,
  DRAFTABLE as immerable
} from "./common"

export { Immer }
