
export const getViewportWidth = () => {
  if (typeof document != 'undefined') {
    return document.documentElement.clientWidth
  }
  return false
}

export const getViewportHeight = () => {
  if (typeof document != 'undefined') {
    return document.documentElement.clientHeight
  }
  return false
}