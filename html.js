import React from 'react'
import { prefixLink } from 'gatsby-helpers'
import { GoogleFont, TypographyStyle } from 'react-typography'
import typography from './utils/typography'
import HTMLScripts from 'html-scripts'
import HTMLStyles from 'html-styles'

module.exports = React.createClass({
  displayName: 'HTML',
  propTypes: {
    body: React.PropTypes.string,
  },
  render() {
    const { body } = this.props
    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta charSet="utf-8" />
          <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />
          <meta name="og:description" content="Krasa is a San Francisco based digital Design and Development company. We specialize in designing and building fast, reliable, and sexy mobile apps, websites, and other digital experiences." />
          <meta name="og:type" content="website" />
          <meta name="og:image" content="http://res.cloudinary.com/krasa/image/upload/v1484009470/Lindsay_Clark_375x300_fjc2yg.jpg" />
          <meta name="og:url" content="www.krasadev.com" />
          <meta name="fb:app_id" content="1871871486381228" />
          <meta name="og:title" content="Krasa | Mobile Web App Design & Development" />
          <title>Krasa | Mobile Web App Design & Development</title>
          <HTMLStyles />
          {this.props.headComponents}
          <TypographyStyle typography={typography} />
          <GoogleFont typography={typography} />
        </head>
        <body className="landing-page">
          <div id="react-mount" dangerouslySetInnerHTML={{ __html: body }} />
          <HTMLScripts scripts={this.props.scripts} />
          <script
            dangerouslySetInnerHTML={{ __html: `
              (function(e, b) {
               if (!b.__SV) {
                   var a, f, i, g;
                   window.mixpanel = b;
                   b._i = [];
                   b.init = function(a, e, d) {
                       function f(b, h) {
                           var a = h.split(".");
                           2 == a.length && (b = b[a[0]], h = a[1]);
                           b[h] = function() {
                               b.push([h].concat(Array.prototype.slice.call(arguments, 0)))
                           }
                       }
                       var c = b;
                       "undefined" !== typeof d ? c = b[d] = [] : d = "mixpanel";
                       c.people = c.people || [];
                       c.toString = function(b) {
                           var a = "mixpanel";
                           "mixpanel" !== d && (a += "." + d);
                           b || (a += " (stub)");
                           return a
                       };
                       c.people.toString = function() {
                           return c.toString(1) + ".people (stub)"
                       };
                       i = "disable time_event track track_pageview track_links track_forms register register_once alias unregister identify name_tag set_config people.set people.set_once people.increment people.append people.union people.track_charge people.clear_charges people.delete_user".split(" ");
                       for (g = 0; g < i.length; g++) f(c, i[g]);
                       b._i.push([a, e, d])
                   };
                   b.__SV = 1.2;
                   a = e.createElement("script");
                   a.type = "text/javascript";
                   a.async = !0;
                   a.src = "undefined" !== typeof MIXPANEL_CUSTOM_LIB_URL ? MIXPANEL_CUSTOM_LIB_URL : "file:" === e.location.protocol && "//cdn.mxpnl.com/libs/mixpanel-2-latest.min.js".match(/^\\/\\//) ? "https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js" : "//cdn.mxpnl.com/libs/mixpanel-2-latest.min.js";
                   f = e.getElementsByTagName("script")[0];
                   f.parentNode.insertBefore(a, f)
               }
             })(document, window.mixpanel || []);
             mixpanel.init("d48f642953a6577c7ce04b1f8e607b9e");
              if (typeof location !== 'undefined' && location.host.match(/krasadev/)) {
                // Only track in production
                mixpanel.track("Page View: " + location.pathname)
              }
            ` }}
          />
        </body>
      </html>
    )
  },
})
