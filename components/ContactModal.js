import { Modal } from 'react-overlays'

import React from 'react'
import { rhythm } from 'utils/typography'
import { prefixLink } from 'gatsby-helpers'
import { colors } from 'utils/colors'
import axios from 'axios'
import qs from 'qs'
import { css, media, presets } from 'glamor'
import EmailInput from 'components/EmailInput'

const FaClose = require('react-icons/lib/fa/close')
const FaAngleRight = require('react-icons/lib/fa/angle-right')

class ContactModal extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      showModal: false,
    }
    this.open = this.open.bind(this)
    this.close = this.close.bind(this)
  }

  render() {
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

    const dialogStyle = () => {
      return {
        width: '100vw',
        height: '100vh',
        position: 'absolute',
        top: 0,
        left: 0,
        border: '1px solid #e5e5e5',
        boxShadow: '0 5px 15px rgba(0,0,0,.5)',
        padding: 20,
      }
    }

    const style = this.props.style || {}
    const mobileStyle = this.props.mobileStyle || {}
    const text = this.props.text || 'contact'

    return (
      <div>
        <input
          type="button"
          css={[
            {
              background: 'none',
              border: 'none',
              display: 'inline',
              color: colors.snow,
              cursor: 'pointer',
              padding: 0,
              ':active': {
                outline: 'none',
              },
              ':visited': {
                outline: 'none',
              },
              ':focus': {
                outline: 'none',
              },
              ...style,
            },
            media(presets.tablet, {
              ...mobileStyle,
            }),
          ]}
          onClick={this.open}
          value={text}
        />
        {this.props.icon && <FaAngleRight size={rhythm(1)} />}
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
                  color: colors.weldonBlue,
                  background: colors.charcoalBlue,
                  border: 'none',
                  outline: 'none',
                  borderRadius: '100%',
                  fontSize: '50px',
                  marginLeft: '-50px',
                  verticalAlign: 'middle',
                }}
                onClick={this.close}
              >
                <FaClose style={{ cursor: 'pointer' }}/>
              </button>
              <h1 style={{ textAlign: 'center' }}>
                We would love to get in touch.
              </h1>
              <h4>
                What's your email address?
              </h4>
                <EmailInput autoFocus />
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
