import React from 'react'
import { rhythm } from 'utils/typography'
import { prefixLink } from 'gatsby-helpers'
import { getViewportWidth, getViewportHeight } from 'utils/helpers'
import { colors } from 'utils/colors'
import { Link } from 'react-router'
import logo from '../media/logo.png'

class Headline extends React.Component {
  render () {
    const width = getViewportWidth()
    const height = getViewportHeight()
    const minDimension = Math.min(width, height)
    return (
      <div
        style={{
          minHeight: '100vh',
          position: 'relative',
          background: colors.grayBlue,
        }}
      >
        <div style={{ width: '100%', height: '100%', position: 'relative', background: colors.snow }}>
          <div style={{width: '100%', height: rhythm(5), display: 'flex', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center'}}>
            <Link
              style={{boxShadow: 'none', display: 'inline-block', fontSize: rhythm(1)}}
              to={prefixLink('/shows/')}
            >
              SHOWS
            </Link>
            <Link
              style={{boxShadow: 'none', display: 'inline-block', fontSize: rhythm(1)}}
              to={prefixLink('/about/')}
            >
              ABOUT
            </Link>
            <img src={logo} style={{height: rhythm(3)}}/>
            <Link
              style={{boxShadow: 'none', display: 'inline-block', fontSize: rhythm(1)}}
              to={prefixLink('/shop/')}
            >
              SHOP
            </Link>
            <Link
              style={{boxShadow: 'none', display: 'inline-block', fontSize: rhythm(1)}}
              to={prefixLink('/contact/')}
            >
              CONTACT
            </Link>
          </div>
        </div>
        <div style={{width: '100%', height: rhythm(5), bottom: 0, left: 0, position: 'absolute', background: colors.snow  }}>
          
        </div>
      </div>
    )
  }
}

Headline.propTypes = {
}

export default Headline
