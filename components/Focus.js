import React from 'react'
import { rhythm } from 'utils/typography'
import { prefixLink } from 'gatsby-helpers'
import SiteMargin from 'components/SiteMargin'
import { colors } from 'utils/colors'
import { css, media, presets, merge } from 'glamor'


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
      css={[
          {
            display: 'flex',
            flexDirection: 'column',
            background: colors.snow,
            minHeight: rhythm(6),
            alignItems: 'center',
            padding: `${rhythm(1)} ${rhythm(2)}`, 
            borderBottom: key === foci.length - 1 ? 0 : `1px solid ${colors.honeydew}`
          },
          media(presets.tablet, {
            flexDirection: 'row',
          }),
      ]}
    >
      <div
        css={[
          {
            fontSize: rhythm(3/2),
            lineHeight: rhythm(3/2),
            marginBottom: rhythm(1),
            textAlign: 'center',
            minWidth: rhythm(5),
          },
          media(presets.tablet, {
            marginRight: rhythm(1),
            textAlign: 'left',
          }),
        ]}
      >
        {headlineText}
      </div>
      <div
        css={[
          {
            padding: `${rhythm(1)} 0`, 
            textAlign: 'center',
            borderTop: `1px solid ${colors.sunny}`,
          },
          media(presets.tablet, {
            borderLeft: `1px solid ${colors.sunny}`,
            borderTop: 0,
            padding: `${rhythm(2)} ${rhythm(1)}`, 
            textAlign: 'left',
          }),
        ]}
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
        css={{
          background: colors.darkSea,
          padding: `${rhythm(4)} ${rhythm(1/2)}`,
        }}
      >
        <SiteMargin>
          <div
            css={{
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
