import React from 'react'
import DocumentTitle from 'react-document-title'
import { Link } from 'react-router'
import get from 'lodash/get'
import { rhythm, adjustFontSizeToMSValue } from 'utils/typography'
import Bio from 'components/Bio'

class Detail extends React.Component {
  render () {
    const product = this.props.data.markdown
    const metadata = get(this.props, 'data.site.siteMetadata')
    return (
      <DocumentTitle title={`${product.frontmatter.title} | ${metadata.title}`}>
        <div>
          <h1>{product.title}</h1>
          <div dangerouslySetInnerHTML={{ __html: product.bodyHTML }} />
          <p
            style={{
              ...adjustFontSizeToMSValue(-1/5),
              display: 'block',
              marginBottom: rhythm(1),
            }}
          >
            producted TODO DATE
          </p>
          <hr
            style={{
              marginBottom: rhythm(1),
            }}
          />
          <Bio
            author={metadata.author}
            city={metadata.homeCity}
          />
        </div>
      </DocumentTitle>
    )
  }
}

export const pageQuery = `
query Article($path: String!) {
  site {
    siteMetadata {
      title
    }
  }
  markdown(path: $path) {
    bodyHTML
    frontmatter {
        title
    }
  }
}
`

export default Detail

