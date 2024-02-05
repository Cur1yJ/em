import _ from 'lodash'
import reactMinistore from './react-ministore'

// take a guess at the height of the virtual keyboard until we can measure it directly
let virtualKeyboardHeightPortrait = window.innerHeight / 2.275
let virtualKeyboardHeightLandscape = window.innerWidth / 1.75

/** A store that tracks the top and bottom of the viewport, taking into account the virtual keyboard. */
const viewportStore = reactMinistore({
  scrollTop: document.documentElement.scrollTop,
  innerHeight: window.innerHeight,
  virtualKeyboardHeight:
    window.innerHeight > window.innerWidth ? virtualKeyboardHeightPortrait : virtualKeyboardHeightLandscape,
})

/** Throttled update of viewport height. */
export const updateHeight = _.throttle(
  () => {
    // There is a bug in iOS Safari where visualViewport.height is incorrect if the phone is rotated with the keyboard up, rotated back, and the keyboard is closed.
    // It can be detected by ensuring the visualViewport portrait mode matches window portrait mode.
    // If it is invalid, go back to the default
    const isPortrait = window.innerHeight > window.innerWidth
    const virtualKeyboardHeight = window.visualViewport ? window.innerHeight - window.visualViewport.height : 0
    const isViewportValid =
      virtualKeyboardHeight > 0 && window.visualViewport!.height > window.visualViewport!.width === isPortrait

    // update the cached virtual keyboard height every time there is a valid visualViewport in case the keyboard has changed
    if (isViewportValid) {
      if (isPortrait) {
        virtualKeyboardHeightPortrait = virtualKeyboardHeight
      } else {
        virtualKeyboardHeightLandscape = virtualKeyboardHeight
      }
    }

    viewportStore.update({
      innerHeight: window.innerHeight,
      virtualKeyboardHeight:
        // when the keyboard is invalid or closed, use the cached height
        isViewportValid
          ? virtualKeyboardHeight
          : isPortrait
            ? virtualKeyboardHeightPortrait
            : virtualKeyboardHeightLandscape,
    })
  },
  // lock to 60 fps
  16.666,
  { leading: true },
)

/** Throttled update of scrollTop. */
export const updateScrollTop = _.throttle(
  () => {
    viewportStore.update({
      scrollTop: document.documentElement.scrollTop,
    })
  },
  // lock to 60 fps
  16.666,
  { leading: true },
)

export default viewportStore
