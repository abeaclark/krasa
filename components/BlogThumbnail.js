import React from 'react'
import { rhythm } from 'utils/typography'
import { colors } from 'utils/colors'
import { prefixLink } from 'gatsby-helpers'
import { Link } from 'react-router'


class BlogThumbnail extends React.Component {
  render () {
    console.log(this.props.path)
    return (
        <Link
            style={{
              maxWidth: rhythm(8),
              padding: rhythm(1),
              margin: rhythm(1/2),
              border: `1px solid ${colors.payneGrey}`,
            }}
            to={prefixLink(this.props.path)}
        >
        <div
          style={{
            fontSize: rhythm(1),
            color: colors.honeydew,
          }}
        >
          {this.props.title}
        </div>
        <div
          style={{
            fontSize: rhythm(1/2),
            color: colors.darkness,
            marginTop: rhythm(1/4),
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
