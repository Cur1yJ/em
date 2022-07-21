import { View } from 'moti'
import React from 'react'
import { Text } from 'react-native'
import { useSelector } from 'react-redux'
import State from '../@types/State'
import expandContextThought from '../action-creators/expandContextThought'
import isContextViewActive from '../selectors/isContextViewActive'
import pathToThought from '../selectors/pathToThought'
import rootedParentOf from '../selectors/rootedParentOf'
import { store } from '../store'
import isDivider from '../util/isDivider'
import isDocumentEditable from '../util/isDocumentEditable'
import ContextBreadcrumbs from './ContextBreadcrumbs'
import Divider from './Divider'
import Editable from './Editable'
import HomeLink from './HomeLink'
import Superscript from './Superscript'
import { ConnectedThoughtProps } from './Thought'

/** A static thought element with overlay bullet, context breadcrumbs, editable, and superscript. */
const StaticThought = ({
  cursorOffset,
  homeContext,
  isEditing,
  path,
  rank,
  showContextBreadcrumbs,
  style,
  simplePath,
  onEdit,
}: ConnectedThoughtProps) => {
  const isRoot = simplePath.length === 1

  const state = store.getState()

  const showContexts = useSelector((state: State) => isContextViewActive(state, rootedParentOf(state, path)))
  const { value } = pathToThought(state, simplePath)

  return (
    <View>
      {showContextBreadcrumbs && !isRoot ? (
        <ContextBreadcrumbs
          simplePath={rootedParentOf(state, rootedParentOf(state, simplePath))}
          homeContext={homeContext}
        />
      ) : showContexts && simplePath.length > 2 ? (
        <Text>
          <Text
            // tabIndex={-1}
            /* TODO: Add setting to enable tabIndex for accessibility */ onMagicTap={() => {
              store.dispatch(expandContextThought(path))
            }}
          >
            ...{' '}
          </Text>
        </Text>
      ) : null}

      {homeContext ? (
        <HomeLink />
      ) : isDivider(value) ? (
        <Divider path={simplePath} />
      ) : (
        // cannot use simplePathLive here else Editable gets re-rendered during editing
        <Editable
          path={path}
          cursorOffset={cursorOffset}
          disabled={!isDocumentEditable()}
          isEditing={isEditing}
          rank={rank}
          style={style}
          simplePath={simplePath}
          onEdit={onEdit}
        />
      )}

      <Superscript simplePath={simplePath} superscript={false} />
    </View>
  )
}

export default StaticThought
