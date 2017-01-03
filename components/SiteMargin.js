import React from 'react'
import { rhythm } from 'utils/typography'
import { prefixLink } from 'gatsby-helpers'

const SiteMargin = ({ children }) =>
    (
      <div
        style={{
          maxWidth: '800px',
          margin: '0 auto',
        }}
      >
        {children}
      </div>
    )

export default SiteMargin
