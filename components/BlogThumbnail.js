import React from 'react'
import { rhythm } from 'utils/typography'
import { colors } from 'utils/colors'

class BlogThumbnail extends React.Component {
  render () {
    return (
        <div 
          style={{
            maxWidth: rhythm(8),
            padding: rhythm(1),
            margin: rhythm(1/2),
            border: `1px solid ${colors.payneGrey}`,
          }}
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

      </div>
    )
  }
}

BlogThumbnail.propTypes = {
  title: React.PropTypes.string,
  previewText: React.PropTypes.string,
  photoURL: React.PropTypes.string,
}

export default BlogThumbnail
