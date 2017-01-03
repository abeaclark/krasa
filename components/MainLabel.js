import React from 'react'
import { rhythm } from 'utils/typography'
import { colors } from 'utils/colors'

class MainLabel extends React.Component {
  render () {
    return (
      <div 
        style={{
          position: 'absolute',
          left: '50%',
          marginLeft: rhythm(-2.5),
          marginTop: rhythm(-3.3),
          padding: rhythm(1/2),
          display: 'inline-block',
          background: colors.snow,
          width: rhythm(5),
          textAlign: 'center',
        }}
      >
        <div 
          style={{
            border: `1px solid ${colors.sunsetOrange}`,
            borderRadius: '100%',
            padding: rhythm(1/4),
          }}
        >
          Products
        </div>
      </div>
    )
  }
}

MainLabel.propTypes = {
}

export default MainLabel
