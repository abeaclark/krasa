import React from 'react'
import { rhythm } from 'utils/typography'
import { prefixLink } from 'gatsby-helpers'
import SiteMargin from 'components/SiteMargin'
import { colors } from 'utils/colors'


const foci = [
  {
    headlineText: (<span>User-<br />Centric<br />Design</span>),
    supportText: "Simple, intuitive interfaces drive successful outcomes. Whether you're building the next Uber, lifestyle blog, or pizza-ordering app, we make sure users find the experience fresh and easy. ",
  },
  {
    headlineText: (<span>Data<br />Is<br />King</span>),
    supportText: "You've got the smarts to edge out the competition, we'll make sure you have the data you need to crunch the numbers. We track page views, interactions, and conversions so you know what's working and what's not.",
  },
  {
    headlineText: (<span>Fast<br />&<br />Solid</span>),
    supportText: "Loading spinners and buggy interfaces push away customers. We're better than that. Our sites and apps load quickly and function worry-free.",
  }
]

const lineItem = ({ headlineText, supportText, key }) =>
  (
     <div
      key={key}
      style={{
        display: 'flex',
        flexDirection: 'row',
        background: colors.snow,
        minHeight: rhythm(6),
        alignItems: 'center',
        padding: `${rhythm(1)} ${rhythm(2)}`, 
        borderBottom: key === foci.length - 1 ? 0 : `1px solid ${colors.honeydew}`
      }}
    >
      <div
        style={{
          minWidth: rhythm(5),
          fontSize: rhythm(3/2),
          lineHeight: rhythm(3/2),
          marginRight: rhythm(1),
        }}
      >
        {headlineText}
      </div>
      <div
        style={{
          borderLeft: `1px solid ${colors.sunny}`,
          padding: `${rhythm(2)} ${rhythm(1)}`, 
        }}
      >
        {supportText}
      </div>
    </div>
  )


class Focus extends React.Component {
  render () {
    const focusElements = foci.map((focusItem, index) =>
      lineItem({
        headlineText: focusItem.headlineText,
        supportText: focusItem.supportText,
        key: index,
      })
    )
    return (
      <div
        style={{
          background: colors.darkSea,
          padding: `${rhythm(4)} ${rhythm(1/2)}`,
        }}
      >
        <SiteMargin>
          <div
            style={{
               display: 'flex',
               flexDirection: 'column',
            }}
          >
            {focusElements}
          </div>
        </SiteMargin>
      </div>
    )
  }
}

Focus.propTypes = {
}

export default Focus
