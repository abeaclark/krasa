import React from 'react'
import { Link } from 'react-router'
import get from 'lodash/get'
import DocumentTitle from 'react-document-title'
import { prefixLink } from 'gatsby-helpers'
import { rhythm } from 'utils/typography'
import include from 'underscore.string/include'
import Bio from 'components/Bio'
import Headline from 'components/Headline'
import Contact from 'components/Contact'

class BlogIndex extends React.Component {
  render () {
    const metadata = get(this.props, 'data.site.siteMetadata')
    const productLinks = []
    const products = get(this, 'props.data.allMarkdown.edges')
    products.forEach((product) => {
      if (product.node.path !== '/404/') {
        const title = get(product, 'node.frontmatter.title') || product.node.path
        productLinks.push(
          <li
            key={product.node.path}
            style={{
              marginBottom: rhythm(1/4),
            }}
          >
            <Link
              style={{boxShadow: 'none'}}
              to={prefixLink(product.node.path)}
            >
              {product.node.frontmatter.title}
            </Link>
          </li>
        )
      }
    })

    return (
      <DocumentTitle title={metadata.title}>
        <div>
          <Headline />
          <Contact />
          <ul>
            {productLinks}
          </ul>
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
        }
      }
    }
  }
}
`
