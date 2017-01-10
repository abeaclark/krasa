import React from 'react'
import { Link } from 'react-router'
import get from 'lodash/get'
import Helmet from "react-helmet"
import { prefixLink } from 'gatsby-helpers'
import { rhythm } from 'utils/typography'
import include from 'underscore.string/include'
import Separator from 'components/Separator'
import Focus from 'components/Focus'
import Team from 'components/Team'
import Process from 'components/Process'
import InquiryForm from 'components/InquiryForm'
import BlogThumbnailContainer from 'components/BlogThumbnailContainer'
import Header from 'components/Header'
import Headline from 'components/Headline'

// import '../css/zenburn.css'

class BlogIndex extends React.Component {
  render () {
    const metadata = get(this.props, 'data.site.siteMetadata')
    const blogEntries = get(this, 'props.data.allMarkdown.edges')
    return (
      <div>
        <Helmet
          title={`${metadata.title} | Web, Mobile & App Design + Development`}
          meta={[
            { name: 'og:type', content: 'website' },
            { name: 'og:image', content: metadata.photoURL },
            { name: 'og:url', content: 'krasadev.com' },
            { name: 'og:description', content: metadata.description },
            { name: 'fb:app_id', content: metadata.fbAppID },
          ]}
        />
        <Header />
        <Headline />
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
      photoURL
      description
      fbAppID
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