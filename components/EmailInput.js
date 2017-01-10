import React from 'react'
import { rhythm } from 'utils/typography'
import { prefixLink } from 'gatsby-helpers'
import { colors } from 'utils/colors'
import axios from 'axios'
import qs from 'qs'
import { css, media, presets } from 'glamor'

const FaArrowCircleORight = require('react-icons/lib/fa/arrow-circle-o-right')

class EmailInput extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      isSubmitted: false,
      validationMessage: null,
      email: '',
    }
    this.setState = this.setState.bind(this)
  }

  submitForm() {
    if (!/(.+)@(.+){2,}\.(.+){2,}/.test(this.state.email)) {
      this.setState({ validationMessage: 'Please enter a valid email' })
      return
    }
    axios.post(
      "https://docs.google.com/forms/d/e/1FAIpQLSeWe-ldEj7_t1tPJl2BRw9Hd4qW55LZwbNUPlo5uUXEU2XxAw/formResponse?origin=*",
      qs.stringify({ 'entry.1565278741': this.state.email }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    )
    // Not using .then() b/c pre-flight fails when using google as backend
    this.setState({ isSubmitted: true })
  }

  setValue(variable, value) {
    const data = {}
    data[variable] = value
    this.setState(data)
  }

  render() {
    const formInput = (
      <form
	     css={{ margin: 0 }}
      >
        <div
          css={{
            position: 'relative',
          }}
        >
          <input
            autoFocus={!!this.props.autoFocus}
            type="email"
            css={[
              {
                background: colors.charcoalBlue,
                maxWidth: '90vw',
                fontSize: rhythm(1/2),
                border: 'none',
                outline: 'none',
                fontFamily: 'inherit',
                padding: `${rhythm(1/2)} ${rhythm(1)}`,
                paddingRight: rhythm(5/2),
              },
              media(presets.tablet, {
                fontSize: rhythm(1),
              }),
            ]}
            placeholder="YourEmail@here.com"
            value={this.state.email}
            onChange={e => this.setValue('email', e.target.value)}
          />
          <button
            css={{
              background: 'none',
              border: 'none',
              fontSize: rhythm(3/2),
              position: 'absolute',
              right: rhythm(1/4),
              top: rhythm(1/4),
            }}
            action="submit"
            onClick={(e) => {e.preventDefault(); this.submitForm()}}
          >
            <FaArrowCircleORight
              color={colors.weldonBlue}
            />
          </button>
          {
            this.state.validationMessage ?
              <div
                css={{
                  fontSize: rhythm(1/2),
                  textAlign: 'center',
                  height: rhythm(1),
                }}
              >
                {this.state.validationMessage}
              </div> :
              <div css={{ height: rhythm(1) }} />
          }
        </div>
      </form>
      )

      const message = (
        <div
          css={{
            fontSize: rhythm(1),
          }}
        >
          Got it, we'll be in touch.
        </div>
      )

    return (
        <div>
          {this.state.isSubmitted ? message : formInput}
        </div>
    )
  }
}

export default EmailInput
