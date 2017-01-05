exports.onRouteUpdate = function (location) {
  // Only track in production
  if (typeof window.mixpanel !== 'undefined' && location.host.match(/krasadev/)) {
    window.mixpanel.track("Page View: " + location.pathname)
  }
}