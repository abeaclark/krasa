import { Modal } from 'react-overlays'

import React from 'react'
import { rhythm } from 'utils/typography'
import { prefixLink } from 'gatsby-helpers'
import { colors } from 'utils/colors'
import axios from 'axios'
import qs from 'qs'
import { css, media, presets } from 'glamor'

const FaArrowCircleORight = require('react-icons/lib/fa/arrow-circle-o-right')
const FaClose = require('react-icons/lib/fa/close')

const modalStyle = {
  position: 'fixed',
  zIndex: 1040,
  top: 0, bottom: 0, left: 0, right: 0
};

const backdropStyle = {
  ...modalStyle,
  zIndex: 'auto',
  backgroundColor: '#FFF',
  opacity: 1,
};

const dialogStyle = function() {
  return {
    width: '100vw',
    height: '100vh',
    position: 'absolute',
    top: 0,
    left: 0,
    border: '1px solid #e5e5e5',
    boxShadow: '0 5px 15px rgba(0,0,0,.5)',
    padding: 20
  };
};


class ContactModal extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      showModal: false,
      submitted: false,
      validationMessage: null,
      email: '',
    }
    this.setState = this.setState.bind(this)
    this.open = this.open.bind(this)
    this.close = this.close.bind(this)
  }

  submitEmail() {
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
    this.setState({submitted: true})
  }

  setValue(variable, value) {
    const data = {}
    data[variable] = value
    this.setState(data)
  }

  render() {
    const inputForm = (
       <form
        css={{ margin: 0 }}
       >
        <div
          css={{
            position: 'relative',
          }}
        >
           <input
              autoFocus
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
              onClick={(e) => {e.preventDefault(); this.submitEmail()}}
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
                height: rhythm(1),
                color: colors.payneGrey,
              }}
              >
                {this.state.validationMessage}
              </div> :
              <div css={{ height: rhythm(1) }}></div>
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
          Thanks, we'll reach out shortly.
        </div>
      )
    return (
      <div>
        <input
          type="button"
          css={{
            background: 'none',
            border: 'none',
            display: 'inline',
            color: colors.darkSea,
            padding: 0,
            ':active': {
              outline: 'none',
            },
            ':visited': {
              outline: 'none',
            },
            ':focus': {
              outline: 'none',
            }
          }}
          onClick={this.open}
          value="CONTACT"
        />
        <Modal
          style={modalStyle}
          backdropStyle={backdropStyle}
          show={this.state.showModal}
          onHide={this.close}
        >
          <div style={dialogStyle()}>
            <div
              css={{
                position: 'relative',
                height: '100%',
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                flexDirection: 'column',
                padding: rhythm(2),
              }}
            >
              <button 
                style={{
                  width: '60px',
                  height: '60px',
                  textAlign: 'center',
                  position: 'absolute',
                  left: '50%',
                  right: '50%',
                  top: rhythm(1),
                  color: colors.darkSea,
                  background: colors.honeydew,
                  border: 'none',
                  outline: 'none',
                  borderRadius: '100%',
                  fontSize: '50px',
                  marginLeft: '-50px',
                }}
                onClick={this.close}
              >
                <FaClose />
              </button>
              <h1 style={{ textAlign: 'center' }}>
                We would love to get in touch.
              </h1>
              <h4>
                What's your email address?
              </h4>
                {this.state.submitted ? message : inputForm}
            </div>
          </div>
        </Modal>
      </div>
    )
  }

  close() {
    this.setState({ showModal: false })
  }

  open() {
    this.setState({ showModal: true })
  }

}

export default ContactModal
