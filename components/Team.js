import React from 'react'
import { rhythm } from 'utils/typography'
import { prefixLink } from 'gatsby-helpers'
import SiteMargin from 'components/SiteMargin'
import { colors } from 'utils/colors'
import { css, media, presets } from 'glamor'

const team = [
  {
    name: "Lindsay",
    title: "Lead Designer",
    description: "I make sure your product is intuitive and beautiful. I collaborate with you to arrive at a fresh, impressive user interface that delivers a top-notch user experience.",
    photo: "http://res.cloudinary.com/krasa/image/upload/v1484009470/Lindsay_Clark_375x300_fjc2yg.jpg",
  },
  {
    name: "Abe",
    title: "Lead Developer",
    description: "I build your product using dependable, current web and app frameworks that ensure a fast and reliable experience. I deliver the data you crave and keep your customers' private information private.",
    photo: "http://res.cloudinary.com/krasa/image/upload/v1484009469/Abe_Clark_375x300_r1gben.jpg",
  },
]

const lineItem = ({ name, title, description, photo, }) =>
  (
     <div
      key={name}
      css={[
        {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          background: colors.snow,
          borderTopRightRadius: '5%',
          borderTopLeftRadius: '5%',
          borderBottom: `5px solid ${colors.almond}`,
          marginBottom: rhythm(1/2),
        },
        media(presets.tablet, {
          flexBasis: '49.5%',
        }),
      ]}
    >
      <img
        src={photo}
        css={{
          width: '100%',
          borderTopRightRadius: '5%',
          borderTopLeftRadius: '5%',
        }}
      />
      <div
        css={{
          fontSize: rhythm(3/2),
          fontWeight: 'bold',
          lineHeight: rhythm(3/2),
          paddingBottom: rhythm(1/2),
          borderBottom: `1px solid ${colors.almond}`,
        }}
      >
        {name}
      </div>
      <div
        css={{
          marginTop: rhythm(1/2),
          fontWeight: 'bold',
        }}
      >
        {title}
      </div>
      <div
        css={{
          textAlign: 'center',
          padding: rhythm(1),
        }}
      >
        {description}
      </div>
    </div>
  )


class Team extends React.Component {
  render () {
    const teamElements = team.map((teamMember) =>
      lineItem({
        ...teamMember
      })
    )
    return (
      <div
        css={{
          background: colors.darkPurple,
          padding: `${rhythm(4)} ${rhythm(1/2)}`,
        }}
      >
        <SiteMargin>
          <div
            css={[
                {
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                },
                media(presets.tablet, {
                 flexDirection: 'row',
                }),
            ]}
          >
            {teamElements}
          </div>
        </SiteMargin>
      </div>
    )
  }
}

Team.propTypes = {
}

export default Team
