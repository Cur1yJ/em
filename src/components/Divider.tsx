import classNames from 'classnames'
import React, { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import Path from '../@types/Path'
import { setCursorActionCreator as setCursor } from '../actions/setCursor'
import { DIVIDER_MIN_WIDTH, DIVIDER_PLUS_PX } from '../constants'
import fastClick from '../util/fastClick'
import useMaxSiblingWidth from '../hooks/useMaxSiblingWidth'
import head from '../util/head'

/** A custom horizontal rule. */
const Divider = ({ path }: { path: Path }) => {
  const dividerSetWidth = React.createRef<HTMLInputElement>()
  const dispatch = useDispatch()
  const [width, setWidth] = useState(DIVIDER_MIN_WIDTH)

  /** Sets the cursor to the divider. */
  const setCursorToDivider = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    dispatch(setCursor({ path }))
  }

  const maxSiblingWidth = useMaxSiblingWidth(dividerSetWidth)

  useEffect(() => {
    if (dividerSetWidth.current) {
      setWidth(maxSiblingWidth > DIVIDER_MIN_WIDTH ? maxSiblingWidth + DIVIDER_PLUS_PX : DIVIDER_MIN_WIDTH)
    }
  }, [maxSiblingWidth])

  return (
    <div
      aria-label='divider'
      ref={dividerSetWidth}
      style={{
        margin: '-2px -4px -5px',
        maxWidth: '100%',
        padding: '10px 4px 16px',
        position: 'relative',
        width,
      }}
      className='divider-container z-index-stack'
      {...fastClick(setCursorToDivider)}
    >
      <div
        className={classNames({
          divider: true,
          // requires editable-hash className to be selected by the cursor navigation via editableNode
          ['editable-' + head(path)]: true,
        })}
      />
    </div>
  )
}

export default Divider
