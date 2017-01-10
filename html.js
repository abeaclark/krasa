import React from 'react'
import { prefixLink } from 'gatsby-helpers'
import { GoogleFont, TypographyStyle } from 'react-typography'
import typography from './utils/typography'
import HTMLScripts from 'html-scripts'
import HTMLStyles from 'html-styles'
import Helmet from 'react-helmet'
import appleicon57x57 from "media/logos/apple-icon-57x57.png"
import appleicon60x60 from "media/logos/apple-icon-60x60.png"
import appleicon72x72 from "media/logos/apple-icon-72x72.png"
import appleicon76x76 from "media/logos/apple-icon-76x76.png"
import appleicon114x114 from "media/logos/apple-icon-114x114.png"
import appleicon120x120 from "media/logos/apple-icon-120x120.png"
import appleicon144x144 from "media/logos/apple-icon-144x144.png"
import appleicon152x152 from "media/logos/apple-icon-152x152.png"
import appleicon180x180 from "media/logos/apple-icon-180x180.png"
import androidicon192x192 from "media/logos/android-icon-192x192.png"
import favicon32x32 from "media/logos/favicon-32x32.png"
import favicon96x96 from "media/logos/favicon-96x96.png"
import favicon16x16 from "media/logos/favicon-16x16.png"

module.exports = React.createClass({
  displayName: 'HTML',
  propTypes: {
    body: React.PropTypes.string,
  },
  render() {
    const { body } = this.props
    const head = Helmet.rewind()
    return (
      <html lang="en">
        <head>
          <link rel="apple-touch-icon" sizes="57x57" href={appleicon57x57} />
          <link rel="apple-touch-icon" sizes="60x60" href={appleicon60x60} />
          <link rel="apple-touch-icon" sizes="72x72" href={appleicon72x72} />
          <link rel="apple-touch-icon" sizes="76x76" href={appleicon76x76} />
          <link rel="apple-touch-icon" sizes="114x114" href={appleicon114x114} />
          <link rel="apple-touch-icon" sizes="120x120" href={appleicon120x120} />
          <link rel="apple-touch-icon" sizes="144x144" href={appleicon144x144} />
          <link rel="apple-touch-icon" sizes="152x152" href={appleicon152x152} />
          <link rel="apple-touch-icon" sizes="180x180" href={appleicon180x180} />
          <link rel="icon" type="image/png" sizes="192x192"  href={androidicon192x192} />
          <link rel="icon" type="image/png" sizes="32x32" href={favicon32x32} />
          <link rel="icon" type="image/png" sizes="96x96" href={favicon96x96} />
          <link rel="icon" type="image/png" sizes="16x16" href={favicon16x16} />

          <meta charSet="utf-8" />
          <meta charSet="utf-8" />
          <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />
          {head.title.toComponent()}
          {head.meta.toComponent()}
          {head.link.toComponent()}
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
