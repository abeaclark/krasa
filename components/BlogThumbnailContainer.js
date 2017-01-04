import React from 'react'
import { rhythm } from 'utils/typography'
import { prefixLink } from 'gatsby-helpers'
import { getViewportWidth, getViewportHeight } from 'utils/helpers'
import { colors } from 'utils/colors'
import { Link } from 'react-router'
// import logo from '../media/logo.png'
import BlogThumbnail from 'components/BlogThumbnail'
import SiteMargin from 'components/SiteMargin'

class BlogThumbnailContainer extends React.Component {
  render () {
    const blogEntries = this.props.blogEntries
    const productElements = []
    blogEntries.forEach((product) => {
      if (product.node.path !== '/404/') {
        productElements.push(
          <BlogThumbnail
            key={product.node.path}
            title={product.node.frontmatter.title}
            photoURL={product.node.frontmatter.photoURL}
            previewText={product.node.frontmatter.previewText}
          />
        )
      }
    })
    return (
      <div
        style={{
          background: colors.darkSea,
          padding: `${rhythm(1)} 0`,
        }}
      >
        <SiteMargin>
           <div
                style={{
                   display: 'flex',
                   flexDirection: 'row',
                   justifyContent: 'space-around',
                   flexWrap: 'wrap',
                }}
              >
              {productElements}
            </div>
        </SiteMargin> 
      </div>
    )
  }
}

BlogThumbnailContainer.propTypes = {
}

export default BlogThumbnailContainer
