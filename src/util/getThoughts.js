import { store } from '../store.js'

// util
import { compareByRank } from './compareByRank.js'
import { getThought } from './getThought.js'
import { hashContext } from './hashContext.js'
// import { equalPath } from './equalPath.js'
// import { getThoughtsDEPRECATED } from './getThoughtsDEPRECATED.js'
// import { pathToContext } from './pathToContext.js'

/** Generates children with their ranking. */
// TODO: cache for performance, especially of the app stays read-only
export const getThoughts = (context, thoughtIndex, contextIndex) => {
  thoughtIndex = thoughtIndex || store.getState().thoughtIndex
  contextIndex = contextIndex || store.getState().contextIndex
  const children = (contextIndex[hashContext(context)] || []) // eslint-disable-line fp/no-mutating-methods
    .filter(child => {
      if (child.value != null && getThought(child.value, thoughtIndex)) {
        return true
      }
      else {
        // TODO: This should never happen
        // console.warn(`Could not find thought for "${child.value} in ${JSON.stringify(pathToContext(context))}`)

        // Mitigation (does not remove thoughtIndex thoughts)
        // setTimeout(() => {
        //   if (store) {
        //     const state = store.getState()
        //     // check again in case state has changed
        //     if (!getThought(child.value, state.thoughtIndex)) {
        //       const contextEncoded = hashContext(context)
        //       store.dispatch({
        //         type: 'thoughtIndex',
        //         contextIndexUpdates: {
        //           [contextEncoded]: (state.contextIndex[contextEncoded] || [])
        //             .filter(child2 => child2.value !== child.value)
        //         }
        //       })
        //     }
        //   }
        // })
        return false
      }
    })
    .sort(compareByRank)

  // allow the results of the new getThoughts which uses contextIndex to be compared against getThoughtsDEPRECATED which uses inefficient contexts collation to test for functional parity at the given probability between 0 (no testing) and 1 (test every call to getThoughts
  // const validategetThoughtsDeprecated = Math.random() < 0.1
  // const childrenDEPRECATED = validategetThoughtsDeprecated ? getThoughtsDEPRECATED(pathToContext(context), thoughtIndex) : undefined

  // // compare with legacy function a percentage of the time to not affect performance
  // if (validategetThoughtsDeprecated && !equalPath(children, childrenDEPRECATED)) {
  //   console.warn(`getThoughts returning different result from getThoughtsDEPRECATED for children of ${JSON.stringify(pathToContext(context))}`)
  //   console.warn({ children })
  //   console.warn({ childrenDEPRECATED })
  // }

  return children
}
