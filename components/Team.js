import React from 'react'
import { rhythm } from 'utils/typography'
import { prefixLink } from 'gatsby-helpers'
import SiteMargin from 'components/SiteMargin'
import { colors } from 'utils/colors'
import Abe from '../media/Abe_Clark_375x300.jpeg'
import Lindsay from '../media/Lindsay_Clark_375x300.jpeg'

const team = [
  {
    name: "Lindsay",
    title: "Lead Designer",
    description: "I make sure your product is intuitive and beautiful. I collaborate with you to arrive at a fresh, impressive user interface that delivers a top-notch user experience.",
    photo: Lindsay,
  },
  {
    name: "Abe",
    title: "Lead Developer",
    description: "I build your product using dependable, current web and app frameworks that ensure a fast and reliable experience. I deliver the data you crave and keep your customers' private information private.",
    photo: Abe,
  },
]

const lineItem = ({ name, title, description, photo, }) =>
  (
     <div
      key={name}
      style={{
        flexBasis: '45%',
        minWidth: '350px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: colors.snow,
        borderTopRightRadius: '5%',
        borderTopLeftRadius: '5%',
        borderBottom: `5px solid ${colors.sunny}`,
      }}
    >
      <img
        src={photo}
        style={{
          maxWidth: 'rhythm(12)',
          borderTopRightRadius: '5%',
          borderTopLeftRadius: '5%',
        }}
      />
      <div
        style={{
          fontSize: rhythm(3/2),
          fontWeight: 'bold',
          lineHeight: rhythm(3/2),
          paddingBottom: rhythm(1/2),
          borderBottom: `1px solid ${colors.sunny}`,
        }}
      >
        {name}
      </div>
      <div
        style={{
          marginTop: rhythm(1/2),
          fontWeight: 'bold',
        }}
      >
        {title}
      </div>
      <div
        style={{
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
        style={{
          background: colors.payneGrey,
          padding: `${rhythm(4)} ${rhythm(1/2)}`,
        }}
      >
        <SiteMargin>
          <div
            style={{
               display: 'flex',
               flexDirection: 'row',
               justifyContent: 'space-between',
            }}
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
