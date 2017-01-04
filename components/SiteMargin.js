import React from 'react'
import { rhythm } from 'utils/typography'
import { prefixLink } from 'gatsby-helpers'
import { css } from 'glamor'

const SiteMargin = ({ children, style={} }) =>
    (
      <div
        css={{
          maxWidth: '800px',
          margin: '0 auto',
          ...style,
        }}
      >
        {children}
      </div>
    )

export default SiteMargin
