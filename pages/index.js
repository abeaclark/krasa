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

class BlogIndex extends React.Component {
  render () {
    const metadata = get(this.props, 'data.site.siteMetadata')
    const products = get(this, 'props.data.allMarkdown.edges')
    return (
      <DocumentTitle title={metadata.title}>
        <div>
          <Separator text="Focus" />
          <Focus />
          <Separator text="Team" />
          <Team />
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
          price
          attributes
          photoURL
        }
      }
    }
  }
}
`
// <Products products={products} />