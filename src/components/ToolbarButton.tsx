import React, { FC, MutableRefObject, useCallback } from 'react'
import { useSelector } from 'react-redux'
import DragToolbarZone from '../@types/DragToolbarZone'
import Icon from '../@types/Icon'
import ShortcutId from '../@types/ShortcutId'
import State from '../@types/State'
import { isTouch } from '../browser'
import { AlertType } from '../constants'
import useToolbarLongPress from '../hooks/useToolbarLongPress'
import themeColors from '../selectors/themeColors'
import { shortcutById } from '../shortcuts'
import store from '../stores/app'
import fastClick from '../util/fastClick'
import DragAndDropToolbarButton, { DraggableToolbarButtonProps } from './DragAndDropToolbarButton'

export interface ToolbarButtonProps {
  // see ToolbarProps.customize
  customize?: boolean
  disabled?: boolean
  fontSize: number
  isPressing: boolean
  lastScrollLeft: MutableRefObject<number>
  onTapCancel?: (e: React.TouchEvent) => void
  onTapDown?: (e: React.MouseEvent | React.TouchEvent) => void
  onTapUp?: (e: React.MouseEvent | React.TouchEvent) => void
  selected?: boolean
  shortcutId: ShortcutId
}

/** A single button in the Toolbar. */
const ToolbarButtonComponent: FC<DraggableToolbarButtonProps> = ({
  customize,
  disabled,
  dragSource,
  dropTarget,
  fontSize,
  isDragging,
  isHovering,
  isPressing,
  lastScrollLeft,
  onTapCancel,
  onTapDown,
  onTapUp,
  selected,
  shortcutId,
}) => {
  const colors = useSelector(themeColors)
  const shortcut = shortcutById(shortcutId)
  if (!shortcut) {
    throw new Error('Missing shortcut: ' + shortcutId)
  }
  const { svg, exec, isActive, canExecute } = shortcut

  if (!svg) {
    throw new Error('The svg property is required to render a shortcut in the Toolbar. ' + shortcutId)
  }

  const isDraggingAny = useSelector((state: State) => state.alert?.alertType === AlertType.DragAndDropToolbarHint)
  const isButtonActive = useSelector((state: State) => (customize ? selected : !isActive || isActive(() => state)))
  const isButtonExecutable = useSelector((state: State) => customize || !canExecute || canExecute(() => state))
  const dropToRemove = useSelector(
    (state: State) => isDragging && state.alert?.alertType === AlertType.ToolbarButtonRemoveHint,
  )
  const longPress = useToolbarLongPress({
    disabled: !customize,
    isDragging,
    shortcut,
    sourceZone: DragToolbarZone.Toolbar,
  })
  const longPressTapUp = longPress.props[isTouch ? 'onTouchEnd' : 'onMouseUp']
  const longPressTapDown = longPress.props[isTouch ? 'onTouchStart' : 'onMouseDown']

  // TODO: type svg correctly
  const SVG = svg as React.FC<Icon>

  /** Handles the onMouseUp/onTouchEnd event. Makes sure that we are actually clicking and not scrolling the toolbar. */
  const tapUp = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      longPress.props[isTouch ? 'onTouchEnd' : 'onMouseUp'](e)
      const iconEl = e.target as HTMLElement
      const toolbarEl = iconEl.closest('.toolbar')!
      const scrolled = isTouch && Math.abs(lastScrollLeft.current - toolbarEl.scrollLeft) >= 5

      if (!customize && isButtonExecutable && !disabled && !scrolled) {
        exec(store.dispatch, store.getState, e, { type: 'toolbar' })

        // prevent Editable blur
        if (isTouch) {
          e.preventDefault()
        }
      }

      lastScrollLeft.current = toolbarEl.scrollLeft

      if (!disabled) {
        onTapUp?.(e)
      }
    },
    [longPressTapUp, customize, isButtonExecutable, disabled],
  )

  /** Handles the onMouseDown/onTouchEnd event. Updates lastScrollPosition for tapUp. */
  const tapDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const iconEl = e.target as HTMLElement
      const toolbarEl = iconEl.closest('.toolbar')!
      longPressTapDown(e)

      lastScrollLeft.current = toolbarEl.scrollLeft

      if (!disabled) {
        onTapDown?.(e)
      }

      if (!customize && !isTouch) {
        e.preventDefault()
      }
    },

    [longPressTapDown, customize, isButtonExecutable, disabled],
  )

  return dropTarget(
    dragSource(
      <div
        {...longPress.props}
        aria-label={shortcut.label}
        key={shortcutId}
        style={{
          // animate maxWidth to avoid having to know the exact width of the toolbar icon
          // maxWidth just needs to exceed the width
          maxWidth: fontSize * 2,
          ...(dropToRemove
            ? {
                // offset 1toolbar-icon padding
                marginLeft: -10,
                maxWidth: 10,
              }
            : null),
          // offset top to avoid changing container height
          // marginBottom: isPressing ? -10 : 0,
          // top: isButtonExecutable && isPressing ? 10 : 0,
          transform: `translateY(${
            isButtonExecutable && isPressing && !longPress.isPressed && !isDragging ? 0.25 : 0
          }em`,
          position: 'relative',
          cursor: isButtonExecutable ? 'pointer' : 'default',
          transition: 'transform 200ms ease-out, max-width 200ms ease-out, margin-left 200ms ease-out',
          // extend drop area down, otherwise the drop hover is blocked by the user's finger
          // must match toolbar marginBottom
          paddingBottom: isDraggingAny ? '7em' : 0,
        }}
        className='toolbar-icon'
        {...fastClick(tapUp, tapDown, onTapCancel)}
      >
        {
          // selected top dash
          selected ? <div style={{ height: 2, backgroundColor: colors.highlight, width: fontSize }}></div> : null
        }

        {
          // drag-and-drop circle overlay
          (longPress.isPressed || isDragging) && !dropToRemove && (
            <div
              style={{
                borderRadius: 999,
                width: fontSize * 1.75,
                height: fontSize * 1.75,
                backgroundColor: colors.gray33,
                position: 'absolute',
                top: 9,
                left: 0,
              }}
            />
          )
        }

        {
          // drop hover
          (isHovering || dropToRemove) && (
            <div
              style={{
                borderRight: dropToRemove ? `dashed 2px ${colors.gray}` : undefined,
                position: 'absolute',
                top: '0.5em',
                left: dropToRemove ? 15 : -2,
                // match the height of the inverted button
                height: fontSize * 1.5,
                width: dropToRemove ? 2 : 3,
                // dropToRemove uses dashed border instead of background color
                backgroundColor: dropToRemove ? 'transparent' : colors.highlight,
              }}
            />
          )
        }
        <SVG
          size={fontSize}
          style={{
            position: 'relative',
            cursor: isButtonExecutable ? 'pointer' : 'default',
            fill:
              longPress.isPressed || isDragging
                ? colors.fg
                : isButtonExecutable && isButtonActive
                ? colors.fg
                : colors.gray,
            width: fontSize + 4,
            height: fontSize + 4,
            opacity: dropToRemove ? 0 : 1,
            transition: 'opacity 200ms ease-out',
          }}
        />
      </div>,
    ),
  )
}

// export drag and drop higher order toolbar button component
const ToolbarButton = DragAndDropToolbarButton(ToolbarButtonComponent)

export default ToolbarButton