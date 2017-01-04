import React from 'react'
import { rhythm } from 'utils/typography'
import { prefixLink } from 'gatsby-helpers'

const SiteMargin = ({ children, style={} }) =>
    (
      <div
        style={{
          maxWidth: '800px',
          margin: '0 auto',
          ...style,
        }}
      >
        {children}
      </div>
    )

export default SiteMargin
