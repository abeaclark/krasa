import React from 'react'
import { rhythm } from 'utils/typography'
import { prefixLink } from 'gatsby-helpers'
import { colors } from 'utils/colors'
import axios from 'axios'
import qs from 'qs'
import { css, media, presets } from 'glamor'
import EmailInput from 'components/EmailInput'

const FaArrowCircleORight = require('react-icons/lib/fa/arrow-circle-o-right')

class InquiryForm extends React.Component {
  render() {
    return (
      <div
        css={{
          height: rhythm(8),
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: colors.raisinBlack,
        }}
      >
        <div
          css={{
            fontSize: rhythm(2),
            fontWeight: 'bold',
          }}
        >
          <h1 css={{ textAlign: 'center', color: colors.snow }}>
            Let's get in touch.
          </h1>
          <EmailInput />
        </div>
      </div>
    )
  }
}

export default InquiryForm
