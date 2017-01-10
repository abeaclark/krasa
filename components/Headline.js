import React from 'react'
import { rhythm } from 'utils/typography'
import { prefixLink } from 'gatsby-helpers'
import SiteMargin from 'components/SiteMargin'
import { colors } from 'utils/colors'
import { css, media, presets } from 'glamor'
import ContactModal from 'components/ContactModal'

class Headline extends React.Component {
  render () {
    return (
      <div
        css={{
          background: colors.darkPurple,
          padding: `${rhythm(2)} ${rhythm(1/2)}`,
          minHeight: '93vh',
        }}
      >
        <SiteMargin>
          <div
            css={[
              {
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-around',
                alignItems: 'center',
                color: colors.snow,
                minHeight: '80vh',
              },
            ]}
          >
            <div
              css={{
                padding: rhythm(1),
                border: `1px solid ${colors.charcoalBlue}`,
              }}
            >
              <h1
                css={[
                  {
                    fontSize: rhythm(2),
                    lineHeight: rhythm(2),
                    color: colors.snow,
                  },
                  media(presets.tablet, {
                    fontSize: rhythm(5),
                    lineHeight: rhythm(5),
                  }),
                ]}
              >
                Let's <br /> Build <br /> Together
              </h1>
              <ContactModal 
                text="Start the Conversation"
                icon
                style={{
                  background: colors.snow,
                  ':hover': {
                    background: colors.almond,
                  },
                  color: colors.weldonBlue,
                  padding: `${rhythm(1/4)} ${rhythm(1/2)}`,
                  marginLeft: rhythm(1/4),
                  marginTop: rhythm(1),
                  fontSize: rhythm(1/2),
                }}
                
                mobileStyle={{
                  padding: `${rhythm(1/2)} ${rhythm(1)}`,
                  marginLeft: rhythm(1/2),
                }}
              />
            </div>
          </div>
        </SiteMargin>
      </div>
    )
  }
}

Headline.propTypes = {
}

export default Headline
