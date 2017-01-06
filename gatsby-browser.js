exports.onRouteUpdate = function (location) {
  // Only track in production
  console.log(window.location)
  if (typeof window.mixpanel !== 'undefined' && window.location.host.match(/krasadev/)) {
    window.mixpanel.track("Page View: " + location.pathname)
  }
}