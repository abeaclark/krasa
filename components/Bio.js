import React from 'react'
import { rhythm } from 'utils/typography'
import { prefixLink } from 'gatsby-helpers'

class Bio extends React.Component {
  render () {
    return (
      <p
        style={{
          marginBottom: rhythm(2.5),
        }}
      >
        Written by <strong>{this.props.author}</strong> who lives and works in {this.props.city} building useful things. <a href="https://twitter.com/kylemathews">You should follow him on Twitter</a>
      </p>
    )
  }
}

Bio.propTypes = {
  author: React.PropTypes.string.isRequired,
  city: React.PropTypes.string.isRequired,
}

export default Bio
