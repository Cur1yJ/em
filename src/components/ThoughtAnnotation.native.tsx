import { View } from 'moti'
import React from 'react'
import { TouchableOpacity } from 'react-native'
import { connect } from 'react-redux'
import Connected from '../@types/Connected'
import Index from '../@types/IndexType'
import Path from '../@types/Path'
import SimplePath from '../@types/SimplePath'
import State from '../@types/State'
import ThoughtContext from '../@types/ThoughtContext'
import ThoughtId from '../@types/ThoughtId'
import setCursor from '../action-creators/setCursor'
import { REGEXP_PUNCTUATIONS } from '../constants'
import { isInternalLink } from '../device/router'
import decodeThoughtsUrl from '../selectors/decodeThoughtsUrl'
import findDescendant from '../selectors/findDescendant'
import getAncestorByValue from '../selectors/getAncestorByValue'
import { getAllChildrenAsThoughts } from '../selectors/getChildren'
import getContexts from '../selectors/getContexts'
import rootedParentOf from '../selectors/rootedParentOf'
import theme from '../selectors/theme'
import { store } from '../store'
import { fadeIn } from '../style/animations'
import { commonStyles } from '../style/commonStyles'
import ellipsizeUrl from '../util/ellipsizeUrl'
import equalPath from '../util/equalPath'
import hashPath from '../util/hashPath'
import head from '../util/head'
import headValue from '../util/headValue'
import isURL from '../util/isURL'
import once from '../util/once'
import parentOf from '../util/parentOf'
import publishMode from '../util/publishMode'
import ContextBreadcrumbs from './ContextBreadcrumbs'
// components
import HomeLink from './HomeLink'
import StaticSuperscript from './StaticSuperscript'
import { Text } from './Text.native'
import UrlIcon from './icons/UrlIcon'

const { from, animate } = fadeIn

interface ThoughtAnnotationProps {
  dark?: boolean
  editingValue?: string | null
  env?: Index<any>
  focusOffset?: number
  homeContext?: boolean
  invalidState?: boolean
  isEditing?: boolean
  minContexts?: number
  path: Path
  showContextBreadcrumbs?: boolean
  showContexts?: boolean
  showHiddenThoughts?: boolean
  simplePath: SimplePath
  style?: React.CSSProperties
}

/** Sets the innerHTML of the ngram text. */
const getTextMarkup = (state: State, isEditing: boolean, value: string, id: ThoughtId) => {
  const labelId = findDescendant(state, id, '=label')
  const labelChildren = labelId ? getAllChildrenAsThoughts(state, labelId) : []
  const { editingValue } = state
  return {
    __html: isEditing
      ? editingValue && value !== editingValue
        ? editingValue
        : value
      : labelChildren.length > 0
      ? labelChildren[0].value
      : ellipsizeUrl(value),
  }
}

/** Adds https to the url if it is missing. Ignores urls at localhost. */
// const addMissingProtocol = (url: string) =>
//   (!url.startsWith('http:') && !url.startsWith('https:') && !url.startsWith('localhost:') ? 'https://' : '') + url

/** A Url icon that links to the url. */
const UrlIconLink = ({ url }: { url: string }) => (
  <TouchableOpacity
    onPress={e => {
      e.stopPropagation() // prevent Editable onMouseDown
      if (isInternalLink(url)) {
        const { path, contextViews } = decodeThoughtsUrl(store.getState(), {
          exists: true,
          url,
        })
        store.dispatch(setCursor({ path, replaceContextViews: contextViews }))
        e.preventDefault()
      }
    }}
  >
    <Text>
      <UrlIcon />
    </Text>
  </TouchableOpacity>
)

// eslint-disable-next-line jsdoc/require-jsdoc
const mapStateToProps = (state: State, props: ThoughtAnnotationProps) => {
  const { cursor, invalidState, editingValue, showHiddenThoughts } = state

  const isEditing = equalPath(cursor, props.path)
  const simplePathLive = isEditing
    ? (parentOf(props.simplePath).concat(head(props.showContexts ? parentOf(cursor!) : cursor!)) as SimplePath)
    : props.simplePath

  return {
    dark: theme(state) !== 'Light',
    editingValue: isEditing ? editingValue : null,
    invalidState: isEditing ? invalidState : false,
    isEditing,
    showHiddenThoughts,
    path: simplePathLive,
    // if a thought has the same value as editValue, re-render its ThoughtAnnotation in order to get the correct number of contexts
    isThoughtValueEditing: editingValue === headValue(state, simplePathLive),
  }
}

/** A non-interactive annotation overlay that contains intrathought links (superscripts and underlining). */
const ThoughtAnnotation = ({
  simplePath,
  showContexts,
  showContextBreadcrumbs,
  homeContext,
  isEditing,
  minContexts = 2,
  dispatch,
  invalidState,
  editingValue,
  style,
  showHiddenThoughts,
}: Connected<ThoughtAnnotationProps>) => {
  // only show real time update if being edited while having meta validation error
  // do not increase numContexts when in an invalid state since the thought has not been updated in state
  const isRealTimeContextUpdate = isEditing && invalidState && editingValue !== null

  const state = store.getState()
  const value = headValue(state, showContexts ? parentOf(simplePath) : simplePath)
  const isExpanded = !!state.expanded[hashPath(simplePath)]
  const childrenUrls = once(() => getAllChildrenAsThoughts(state, head(simplePath)).filter(child => isURL(child.value)))

  // no contexts if thought is empty
  const contexts = value !== '' ? getContexts(state, isRealTimeContextUpdate ? editingValue! : value) : []

  const url = isURL(value)
    ? value
    : // if the only subthought is a url and the thought is not expanded, link the thought
    !isExpanded && childrenUrls().length === 1 && (!state.cursor || !equalPath(simplePath, parentOf(state.cursor)))
    ? childrenUrls()[0].value
    : null

  /** Returns true if the thought is not archived. */
  const isNotArchive = (thoughtContext: ThoughtContext) =>
    // thoughtContext.context should never be undefined, but unfortunately I have personal thoughts in production with no context. I am not sure whether this was old data, or if it's still possible to encounter, so guard against undefined context for now.
    showHiddenThoughts || !getAncestorByValue(state, thoughtContext, '=archive')

  const numContexts = contexts.filter(isNotArchive).length + (isRealTimeContextUpdate ? 1 : 0)

  return (
    <View
      style={homeContext ? commonStyles.marginLeft : {}}
      from={from}
      animate={animate}
      transition={{ type: 'timing' }}
    >
      {showContextBreadcrumbs && simplePath.length > 1 && (
        <ContextBreadcrumbs simplePath={rootedParentOf(state, rootedParentOf(state, simplePath))} />
      )}

      {homeContext ? (
        <HomeLink />
      ) : (
        <View from={from} animate={animate} transition={{ type: 'timing' }}>
          <Text>{getTextMarkup(state, !!isEditing, value, head(simplePath)).__html}</Text>
          {
            // do not render url icon on root thoughts in publish mode
            url && !(publishMode() && simplePath.length === 1) && <UrlIconLink url={url} />
          }
          {REGEXP_PUNCTUATIONS.test(value) ? null : minContexts === 0 || // with real time context update we increase context length by 1 // with the default minContexts of 2, do not count the whole thought
            numContexts > 1 ? (
            <StaticSuperscript n={numContexts} />
          ) : null}
        </View>
      )}
    </View>
  )
}

export default connect(mapStateToProps)(ThoughtAnnotation)