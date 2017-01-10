import React from 'react'
import Helmet from "react-helmet"
import { Link } from 'react-router'
import get from 'lodash/get'
import { rhythm, adjustFontSizeToMSValue } from 'utils/typography'
import SiteMargin from 'components/SiteMargin'
import { authors } from 'utils/authors'
const FaLinkedin = require('react-icons/lib/fa/linkedin')
// import '../css/zenburn.css'
import Header from 'components/Header'

class Detail extends React.Component {
  render () {
    const blogPost = this.props.data.markdown
    const metadata = get(this.props, 'data.site.siteMetadata')
    const author = authors[blogPost.frontmatter.author]
    return (
      <div>
        <Helmet
          title={`${blogPost.frontmatter.title} | ${metadata.title}`}
          meta={[
            { name: 'og:type', content: 'article' },
            { name: 'og:image', content: (blogPost.photoURL || metadata.photoURL || '') },
            { name: 'og:url', content: 'krasadev.com' },
            { name: 'og:description', content: metadata.description },
            { name: 'og:app_id', content: metadata.fbAppID },
          ]}
        />
        <Header />
        <h1
          style={{ textAlign: 'center', margin: 0, }}
        >
          <SiteMargin style={{ padding: `${rhythm(2)} ${rhythm(1)}` }}>
            {blogPost.frontmatter.title}
          </SiteMargin>
        </h1>
        <SiteMargin style={{ padding: `0 ${rhythm(1/2)}` }}>
          <div dangerouslySetInnerHTML={{ __html: blogPost.bodyHTML }} />
        </SiteMargin>
        <div>
          <SiteMargin style={{ padding: rhythm(1) }}>
            <div
              style={{
                position: 'relative',
                height: rhythm(2),
              }}
            >
              <img
                src={author.thumbnail}
                style={{
                  height: rhythm(2),
                  borderRadius: '100%',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: rhythm(2),
                  paddingLeft: rhythm(1/2),
                  top: 0,
                }}
              >
                <a href={author.linkedIn}>
                  {author.firstName}{' '}{author.lastName}
                </a>
                <br/>
                {author.city},{' '}{author.state}
                
              </div>
            </div>
          </SiteMargin>
        </div>
      </div>
    )
  }
}

export const pageQuery = `
query Article($path: String!) {
  site {
    siteMetadata {
      title
      photoURL
      fbAppID
      description
    }
  }
  markdown(path: $path) {
    bodyHTML
    frontmatter {
        title
        author
        photoURL
    }
  }
}
`

export default Detail

