import React from 'react'
import { rhythm } from 'utils/typography'
import { prefixLink } from 'gatsby-helpers'
import { colors } from 'utils/colors'
import axios from 'axios'
import qs from 'qs'
import { css, media, presets } from 'glamor'

const FaArrowCircleORight = require('react-icons/lib/fa/arrow-circle-o-right')

class InquiryForm extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      step: 0,
      validationMessage: null,
      email: '',
    }
    this.setState = this.setState.bind(this)
  }

  advanceStep() {
    if (!/(.+)@(.+){2,}\.(.+){2,}/.test(this.state.email)) {
      this.setState({validationMessage: 'Please enter a valid email'})
      return
    }
    axios.post(
      "https://docs.google.com/forms/d/e/1FAIpQLSeWe-ldEj7_t1tPJl2BRw9Hd4qW55LZwbNUPlo5uUXEU2XxAw/formResponse?origin=*",
      qs.stringify({ 'entry.1565278741': this.state.email }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    )
    // Not using .then() b/c pre-flight fails when using google as backend
    this.setState({step: this.state.step + 1})
  }

  setValue(variable, value) {
    const data = {}
    data[variable] = value
    this.setState(data)
  }

  render () {
    const steps = [
      (
       <form
        css={{ margin: 0 }}
       >
        <h1 css={{ textAlign: 'center' }}>
          Let's get in touch.
        </h1>
        <div
          css={{
            position: 'relative',
          }}
        >
           <input
              type="email"
              css={[
                {
                   background: colors.honeydew,
                  maxWidth: '90vw',
                  fontSize: rhythm(1/2),
                  border: 'none',
                  outline: 'none',
                  fontFamily: 'inherit',
                  padding: `${rhythm(1/2)} ${rhythm(1)}`,
                  paddingRight: rhythm(5/2)
                },
                media(presets.tablet, {
                 fontSize: rhythm(1),
                }),
              ]}
              placeholder="YourEmail@here.com"
              value={this.state.email}
              onChange={(e) => this.setValue('email', e.target.value)}
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
              onClick={(e) => {e.preventDefault(); this.advanceStep()}}
            >
              <FaArrowCircleORight 
                color={colors.darkSea}
              />
            </button>
            {
              this.state.validationMessage ?
              <div
              css={{
                fontSize: rhythm(1/2),
                textAlign: 'center',
                height: rhythm(1)
              }}
              >
                {this.state.validationMessage}
              </div> :
              <div css={{ height: rhythm(1) }}></div>
            }
          </div>
        </form>
      ),
      (
       <div
          css={{
            fontSize: rhythm(1),
          }}
        >
          Got it, we'll be in touch.
        </div>
      ),
    ]
    const currentStep = steps[this.state.step]
    return (
      <div
        css={{
          height: rhythm(8),
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: colors.sunny,
        }}
      >
        <div
          css={{
            fontSize: rhythm(2),
            fontWeight: 'bold',
            color: colors.darkSea,
          }}
        >
          {currentStep}
        </div>
      </div>
    )
  }
}

export default InquiryForm
