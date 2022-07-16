import _ from 'lodash'
import Path from '../@types/Path'
import SimplePath from '../@types/SimplePath'
import State from '../@types/State'
import { DROP_TARGET } from '../constants'

interface Payload {
  value: boolean
  draggingThought?: SimplePath
  hoveringPath?: Path
  hoverId?: DROP_TARGET
  offset?: number
}

/** Sets dragInProgress. */
const dragInProgress = (state: State, { value, draggingThought, hoveringPath, hoverId, offset }: Payload): State => ({
  ...state,
  dragInProgress: value,
  draggingThought,
  hoveringPath,
  hoverId,
  cursorOffset: offset || state.cursorOffset,
})

export default _.curryRight(dragInProgress)