import React from 'react'
import { rhythm } from 'utils/typography'
import { getViewportWidth, getViewportHeight } from 'utils/helpers'
import { colors } from 'utils/colors'
// import logo from '../media/logo.png'
import BlogThumbnail from 'components/BlogThumbnail'
import SiteMargin from 'components/SiteMargin'
import { css, media, presets } from 'glamor'

class BlogThumbnailContainer extends React.Component {
  render () {
    const blogEntries = this.props.blogEntries
    const entryElements = []
    blogEntries.forEach((entry) => {
      if (entry.node.path !== '/404/') {
        entryElements.push(
          <BlogThumbnail
            key={entry.node.path}
            title={entry.node.frontmatter.title}
            photoURL={entry.node.frontmatter.photoURL}
            previewText={entry.node.frontmatter.previewText}
            path={entry.node.path}
          />
        )
      }
    })
    return (
      <div
        css={[
          {
            background: colors.raisinBlack,
            padding: `${rhythm(2)} 0`,
          },
          media(presets.tablet, {
            padding: `${rhythm(4)} 0`,
          }),
        ]}
      >
        <SiteMargin>
          <div
            css={[
              {
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'space-around',
                flexWrap: 'wrap',
                border: `1px solid ${colors.weldonBlue}`,
                padding: `${rhythm(1/2)} ${rhythm(1/4)}`,
              },
              media(presets.tablet, {
                padding: `${rhythm(1)} ${rhythm(1/4)}`,
              }),
            ]}
          >
            {entryElements}
          </div>
        </SiteMargin>
      </div>
    )
  }
}

BlogThumbnailContainer.propTypes = {
}

export default BlogThumbnailContainer
