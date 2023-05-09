import _ from 'lodash'
import Path from '../@types/Path'
import SimplePath from '../@types/SimplePath'
import State from '../@types/State'
import ThoughtId from '../@types/ThoughtId'
import {
  ABSOLUTE_PATH,
  ABSOLUTE_TOKEN,
  TUTORIAL2_STEP_CONTEXT1,
  TUTORIAL2_STEP_CONTEXT1_HINT,
  TUTORIAL2_STEP_CONTEXT1_PARENT,
  TUTORIAL2_STEP_CONTEXT1_PARENT_HINT,
  TUTORIAL2_STEP_CONTEXT2,
  TUTORIAL2_STEP_CONTEXT2_HINT,
  TUTORIAL2_STEP_CONTEXT2_PARENT,
  TUTORIAL2_STEP_CONTEXT2_PARENT_HINT,
  TUTORIAL_STEP_FIRSTTHOUGHT,
  TUTORIAL_STEP_FIRSTTHOUGHT_ENTER,
  TUTORIAL_STEP_SECONDTHOUGHT,
  TUTORIAL_STEP_SECONDTHOUGHT_ENTER,
  TUTORIAL_STEP_SUBTHOUGHT,
} from '../constants'
import getTextContentFromHTML from '../device/getTextContentFromHTML'
import alert from '../reducers/alert'
import createThought from '../reducers/createThought'
import setCursor from '../reducers/setCursor'
import tutorialNext from '../reducers/tutorialNext'
import tutorialStepReducer from '../reducers/tutorialStep'
import findDescendant from '../selectors/findDescendant'
import { getChildrenSorted } from '../selectors/getChildren'
import getNextRank from '../selectors/getNextRank'
import getPrevRank from '../selectors/getPrevRank'
import getRankAfter from '../selectors/getRankAfter'
import getRankBefore from '../selectors/getRankBefore'
import getRootPath from '../selectors/getRootPath'
import getSetting from '../selectors/getSetting'
import getSortPreference from '../selectors/getSortPreference'
import getThoughtById from '../selectors/getThoughtById'
import isContextViewActive from '../selectors/isContextViewActive'
import rootedParentOf from '../selectors/rootedParentOf'
import simplifyPath from '../selectors/simplifyPath'
import appendToPath from '../util/appendToPath'
import createId from '../util/createId'
import ellipsize from '../util/ellipsize'
import head from '../util/head'
import headValue from '../util/headValue'
import isRoot from '../util/isRoot'
import once from '../util/once'
import parentOf from '../util/parentOf'
import reducerFlow from '../util/reducerFlow'
import unroot from '../util/unroot'

export interface NewThoughtPayload {
  /** The Path which the new thought is inserted after, unless insertBefore or insertNewSubthought are specified. */
  at?: Path
  /** Callback for when the updates have been synced with IDB. */
  idbSynced?: () => void
  insertNewSubthought?: boolean
  insertBefore?: boolean
  value?: string
  offset?: number
  aboveMeta?: boolean
  preventSetCursor?: boolean
  splitSource?: ThoughtId
}

/** Adds a new thought to the cursor. Calculates the rank to add the new thought above, below, or within a thought.
 *
 * @param offset The focusOffset of the selection in the new thought. Defaults to end.
 */
const newThought = (state: State, payload: NewThoughtPayload | string) => {
  // optionally allow string value to be passed as entire payload
  if (typeof payload === 'string') {
    payload = { value: payload }
  }

  const {
    at,
    idbSynced,
    insertNewSubthought,
    insertBefore,
    value = '',
    offset,
    preventSetCursor,
    aboveMeta,
    splitSource,
  }: NewThoughtPayload = payload

  const tutorialStep = +(getSetting(state, 'Tutorial Step') || 0)
  const tutorialStepNewThoughtCompleted =
    // new thought
    (!insertNewSubthought &&
      (Math.floor(tutorialStep) === TUTORIAL_STEP_FIRSTTHOUGHT ||
        Math.floor(tutorialStep) === TUTORIAL_STEP_SECONDTHOUGHT)) ||
    // new thought in context
    (insertNewSubthought && Math.floor(tutorialStep) === TUTORIAL_STEP_SUBTHOUGHT) ||
    // enter after typing text
    (state.cursor &&
      headValue(state, state.cursor).length > 0 &&
      (tutorialStep === TUTORIAL_STEP_SECONDTHOUGHT_ENTER || tutorialStep === TUTORIAL_STEP_FIRSTTHOUGHT_ENTER))

  const path = at || state.cursor || getRootPath(state)

  const simplePath = simplifyPath(state, path)

  const parentPath = rootedParentOf(state, simplePath)
  const thoughtId = head(simplePath)
  const parentId = head(parentPath)

  // prevent adding Subthought to readonly or unextendable Thought
  const sourceId = insertNewSubthought ? thoughtId : parentId
  const sourceThought = getThoughtById(state, sourceId)
  if (findDescendant(state, sourceId, '=readonly')) {
    return alert(state, {
      value: `"${ellipsize(sourceThought.value)}" is read-only. No subthoughts may be added.`,
    })
  } else if (findDescendant(state, sourceId, '=unextendable')) {
    return alert(state, {
      value: `"${ellipsize(sourceThought.value)}" is unextendable. No subthoughts may be added.`,
    })
  }

  const showContexts = isContextViewActive(state, path)
  const showContextsParent = isContextViewActive(state, rootedParentOf(state, path))
  const insertContext = (showContextsParent && !insertNewSubthought) || (showContexts && insertNewSubthought)

  /** Gets the Path of the last visible child in a SimplePath if it is a sorted context. */
  const getLastSortedChildPath = once((): SimplePath | null => {
    const lastChild = _.last(getChildrenSorted(state, thoughtId))
    return lastChild ? appendToPath(simplePath, lastChild.id) : null
  })

  // if meta key is pressed, add a child instead of a sibling of the current thought
  // if shift key is pressed, insert the child before the current thought
  const newRank = insertContext
    ? getNextRank(state, ABSOLUTE_TOKEN)
    : insertBefore
    ? insertNewSubthought || !simplePath || isRoot(simplePath)
      ? getPrevRank(state, thoughtId, { aboveMeta })
      : getRankBefore(state, simplePath)
    : insertNewSubthought || !simplePath
    ? // if inserting an empty thought into a sorted context via insertNewSubthought, get the rank after the last sorted child rather than incrementing the highest rank
      // otherwise the empty thought will not be correctly sorted by resortEmptyInPlace
      value === '' && getSortPreference(state, thoughtId).type === 'Alphabetical' && getLastSortedChildPath()
      ? getRankAfter(state, getLastSortedChildPath()!)
      : getNextRank(state, thoughtId)
    : getRankAfter(state, simplePath)

  // when creating a new context in a context view, newThoughtId is the new empty thought (a/~m/_), and newContextId is the newly added Lexeme context (/ABS/_/m)
  const newThoughtId = createId()
  const newContextId = insertContext ? createId() : null

  const reducers = [
    // createThought
    createThought({
      ...(insertContext ? { children: [newContextId!] } : null),
      path: insertContext ? ABSOLUTE_PATH : insertNewSubthought ? simplePath : parentPath,
      rank: newRank,
      value,
      id: newThoughtId,
      idbSynced,
      splitSource,
    }),

    // if adding a new context to the context view, add the thought to the new context
    insertContext
      ? createThought({
          path: [ABSOLUTE_TOKEN, newThoughtId] as unknown as SimplePath,
          rank: 0,
          value: headValue(state, insertNewSubthought ? path : parentOf(path)),
          id: newContextId!,
          splitSource,
        })
      : null,

    // setCursor
    (newState: State) => {
      const parentPath = !preventSetCursor ? unroot(insertNewSubthought ? path : parentOf(path)) : null

      return !preventSetCursor
        ? setCursor(newState, {
            editing: true,
            path: unroot([...parentPath!, newThoughtId]),
            offset: offset != null ? offset : getTextContentFromHTML(value).length,
          })
        : null
    },

    // tutorial step 1
    tutorialStepNewThoughtCompleted
      ? tutorialNext({})
      : // some hints are rolled back when a new thought is created
      tutorialStep === TUTORIAL2_STEP_CONTEXT1_PARENT_HINT
      ? tutorialStepReducer({ value: TUTORIAL2_STEP_CONTEXT1_PARENT })
      : tutorialStep === TUTORIAL2_STEP_CONTEXT1_HINT
      ? tutorialStepReducer({ value: TUTORIAL2_STEP_CONTEXT1 })
      : tutorialStep === TUTORIAL2_STEP_CONTEXT2_PARENT_HINT
      ? tutorialStepReducer({ value: TUTORIAL2_STEP_CONTEXT2_PARENT })
      : tutorialStep === TUTORIAL2_STEP_CONTEXT2_HINT
      ? tutorialStepReducer({ value: TUTORIAL2_STEP_CONTEXT2 })
      : null,
  ]

  return reducerFlow(reducers)(state)
}

export default _.curryRight(newThought)
