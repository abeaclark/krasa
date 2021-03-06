import React from 'react'
import { rhythm } from 'utils/typography'
import { prefixLink } from 'gatsby-helpers'
import { colors } from 'utils/colors'
import { css, after } from 'glamor'

const Separator = ({ text, angle=true }) =>
    (
      <div
        css={[
          {
            height: rhythm(8),
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            background: colors.charcoalBlue,
            position: 'relative',
            zIndex: 1,
            borderTop: `40px solid ${colors.almond}`,
          },
        ]}
      >
        {angle &&
          <div
            css={{
              background: 'inherit',
              top: '0',
              content: 'asdf',
              display: 'block',
              height: rhythm(8),
              left: '0',
              position: 'absolute',
              right: '0',
              transform: 'skewY(3deg)',
              transformOrigin: '100%',
              zIndex: -1,
            }}
          />
        }
        <h1
          css={{
            fontSize: rhythm(2),
            fontWeight: 'bold',
            color: colors.snow,
          }}
        >
          {text}
        </h1>
        {angle &&
          <div
            css={{
              background: 'inherit',
              bottom: '0',
              content: 'asdf',
              display: 'block',
              height: rhythm(8),
              left: '0',
              position: 'absolute',
              right: '0',
              transform: 'skewY(-3deg)',
              transformOrigin: '100%',
              zIndex: -1,
            }}
          />
        }
      </div>
    )

export default Separator
