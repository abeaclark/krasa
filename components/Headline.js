import React from 'react'
import { rhythm } from 'utils/typography'
import { prefixLink } from 'gatsby-helpers'
import { getViewportWidth, getViewportHeight } from 'utils/helpers'
import { colors } from 'utils/colors'

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
        }}
      >
        <div
          style={{
            margin: '0 auto',
            width: minDimension,
            height: minDimension,
            borderRadius: '100%',
            background: colors.ebony,
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div style={{ width: '100%', height: '100%', position: 'relative'}}>
            <h1
              style={{ 
                background: colors.snow,
                width: '100%',
                padding: rhythm(1),
                textAlign: 'center',
                position: 'absolute',
                top: '70%',
                left: '50%',
                transform: 'translate(-50%, -50%)',            
              }}
            >I BUILD WEBSITES</h1>
          </div>
        </div>
      </div>
    )
  }
}

Headline.propTypes = {
}

export default Headline
