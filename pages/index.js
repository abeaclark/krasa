import React from 'react'
import { Link } from 'react-router'
import get from 'lodash/get'
import DocumentTitle from 'react-document-title'
import { prefixLink } from 'gatsby-helpers'
import { rhythm } from 'utils/typography'
import include from 'underscore.string/include'
import Separator from 'components/Separator'
import Focus from 'components/Focus'
import Team from 'components/Team'
import Process from 'components/Process'
import InquiryForm from 'components/InquiryForm'
import BlogThumbnailContainer from 'components/BlogThumbnailContainer'

class BlogIndex extends React.Component {
  render () {
    const metadata = get(this.props, 'data.site.siteMetadata')
    const blogEntries = get(this, 'props.data.allMarkdown.edges')
    return (
      <DocumentTitle title={metadata.title}>
        <div>
          <Separator text="Process" />
          <Process />
          <Separator text="Focus" />
          <Focus />
          <Separator text="Blog" />
          <BlogThumbnailContainer blogEntries={blogEntries} />
          <Separator text="Team" />
          <Team />
          <InquiryForm />
        </div>
      </DocumentTitle>
    )
  }
}

BlogIndex.propTypes = {
  route: React.PropTypes.object,
}

export default BlogIndex

export const pageQuery = `
{
  site {
    buildTime
    siteMetadata {
      title
      homeCity
      author
    }
  }
  allMarkdown(first: 2000) {
    edges {
      node {
        path
        frontmatter {
          title
          photoURL
          previewText
        }
      }
    }
  }
}
`
// <Products products={products} />