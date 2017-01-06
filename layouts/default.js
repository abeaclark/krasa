import React from 'react'
import { colors } from 'utils/colors'
import '../css/prism-coy.css'

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
