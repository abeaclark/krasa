import React from 'react'
import { rhythm } from 'utils/typography'
import { prefixLink } from 'gatsby-helpers'
import { colors } from 'utils/colors'

const Separator = ({ text }) =>
    (
      <div
        style={{
          height: rhythm(8),
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: colors.snow,
        }}
      >
        <div
          style={{
            fontSize: rhythm(2),
            fontWeight: 'bold',
            color: colors.darkSea,
          }}
        >
          {text}
        </div>
      </div>
    )

export default Separator
