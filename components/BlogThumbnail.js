import React from 'react'
import { rhythm } from 'utils/typography'
import { colors } from 'utils/colors'
import { prefixLink } from 'gatsby-helpers'
import { Link } from 'react-router'
import { css } from 'glamor'


class BlogThumbnail extends React.Component {
  render () {
    console.log(this.props.path)
    return (
        <Link
            css={{
              maxWidth: rhythm(8),
              padding: rhythm(1),
              margin: rhythm(1/2),
              border: `1px solid ${colors.darkPurple}`,
              background: colors.snow,
            }}
            to={prefixLink(this.props.path)}
        >
        <div
          css={{
            fontSize: rhythm(1),
            color: colors.weldonBlue,
          }}
        >
          {this.props.title}
        </div>
        <div
          css={{
            fontSize: rhythm(1/2),
            lineHeight: rhythm(3/4),
            color: colors.darkPurple,
            marginTop: rhythm(1/2),
          }}
        >
          {this.props.previewText}
        </div>

      </Link>
    )
  }
}

BlogThumbnail.propTypes = {
  title: React.PropTypes.string,
  previewText: React.PropTypes.string,
  photoURL: React.PropTypes.string,
}

export default BlogThumbnail
