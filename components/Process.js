import React from 'react'
import { rhythm } from 'utils/typography'
import { prefixLink } from 'gatsby-helpers'
import SiteMargin from 'components/SiteMargin'
import { colors } from 'utils/colors'

const FaMapO = require('react-icons/lib/fa/map-o')
const FaObjectGroup = require('react-icons/lib/fa/object-group')
const FaWrench = require('react-icons/lib/fa/wrench')
import { css, media, presets } from 'glamor'


const processPoints = [
  {
    headlineText: "Scope It.",
    supportingText: "We'll chat about audience, goals, features, and timeline. We'll figure out a plan to fit your budget and accomplish your objective.",
    icon: React.createElement(FaMapO, null),
  },
  {
    headlineText: "Design It.",
    supportingText: "Our design team will collaborate with you and develop wireframes and then hi-fidelity mocks of the product. (You'll have a big grin on your face by this point).",
    icon: React.createElement(FaObjectGroup, null),
  },
  {
    headlineText: "Build It.",
    supportingText: "Once we've agreed on the design, our development team will build and test the product. We'll make sure everything is well documented for a streamlined handoff.",
    icon: React.createElement(FaWrench, null),
  },
]

const lineItem = ({ headlineText, supportingText, icon, key }) =>
  (
     <div
      key={key}
      css={[
        {
          minWidth: '250px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          background: colors.snow,
          borderBottom: `5px solid ${colors.almond}`,
          padding: rhythm(1/2),
          marginBottom: rhythm(1),
        },
        media(presets.tablet, {
          flexBasis: '33%',
        }),
      ]}
    >
      <div
        css={{
          fontSize: rhythm(2),
          textAlign: 'center',
          color: colors.weldonBlue,
          padding: rhythm(1/2),
          borderRadius: '100',
          background: colors.charcoalBlue,
          marginTop: rhythm(1),
          marginBottom: rhythm(1),
        }}
      >
        {icon}
      </div>
      <div
        css={{
          fontSize: rhythm(3/2),
          fontWeight: 'bold',
          lineHeight: rhythm(3/2),
          paddingBottom: rhythm(1/2),
          borderBottom: `1px solid ${colors.almond}`,
        }}
      >
        {headlineText}
      </div>
      <div
        css={{
          textAlign: 'center',
          padding: rhythm(1),
        }}
      >
        {supportingText}
      </div>
    </div>
  )


class Process extends React.Component {
  render () {
    const processElements = processPoints.map((processPoint, key) =>
      lineItem({
        ...processPoint,
        key
      })
    )
    return (
      <div
        css={{
          background: colors.raisinBlack,
          padding: `${rhythm(4)} ${rhythm(1/2)}`,
        }}
      >
        <SiteMargin>
          <div
            css={[
                {
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-around',
                },
                media(presets.tablet, {
                  flexDirection: 'row',
                }),
            ]}
          >
            {processElements}
          </div>
        </SiteMargin>
      </div>
    )
  }
}

Process.propTypes = {
}

export default Process
