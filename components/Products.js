import React from 'react'
import { rhythm } from 'utils/typography'
import { prefixLink } from 'gatsby-helpers'
import { getViewportWidth, getViewportHeight } from 'utils/helpers'
import { colors } from 'utils/colors'
import { Link } from 'react-router'
import logo from '../media/logo.png'
import MainLabel from 'components/MainLabel'

class Products extends React.Component {
  render () {
    return (
      <div
        style={{
          minHeight: '100vh',
          position: 'relative',
          display: 'flex',
          padding: rhythm(1),
        }}
      >
        <div style={{border: '1px solid gray', width: '100%', minHeight: '90vh' }}>
          <MainLabel />
          {this.props.children}
        </div>
      </div>
    )
  }
}

Products.propTypes = {
}

export default Products
