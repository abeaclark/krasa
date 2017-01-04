import React from 'react'
import { Link } from 'react-router'
import get from 'lodash/get'
import DocumentTitle from 'react-document-title'
import { prefixLink } from 'gatsby-helpers'
import { rhythm } from 'utils/typography'
import Separator from 'components/Separator'
import InquiryForm from 'components/InquiryForm'
import BlogThumbnailContainer from 'components/BlogThumbnailContainer'
import Header from 'components/Header'

class BlogIndex extends React.Component {
  render () {
    const metadata = get(this.props, 'data.site.siteMetadata')
    const blogEntries = get(this, 'props.data.allMarkdown.edges')
    return (
      <DocumentTitle title={metadata.title}>
        <div>
          <Header />
          <Separator text="Blog" />
          <BlogThumbnailContainer blogEntries={blogEntries} />
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