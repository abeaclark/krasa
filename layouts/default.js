import React from 'react'
import { Link } from 'react-router'
import { Container } from 'react-responsive-grid'
import { prefixLink } from 'gatsby-helpers'
import { rhythm, adjustFontSizeToMSValue } from 'utils/typography'
import { colors } from 'utils/colors'

class Template extends React.Component {
  render () {
    const { location, children } = this.props
    return (
      <div
        style={{ background: colors.snow }}
      >
        {children}
      </div>
    )
  }
}

Template.propTypes = {
  children: React.PropTypes.any,
  location: React.PropTypes.object,
  route: React.PropTypes.object,
}

export default Template
