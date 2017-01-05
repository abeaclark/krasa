import React from 'react'
import { rhythm } from 'utils/typography'
import { prefixLink } from 'gatsby-helpers'
import Headroom from 'react-headroom'
import SiteMargin from 'components/SiteMargin'
import ContactModal from 'components/ContactModal'
import { colors } from 'utils/colors'
import { Link } from 'react-router'
import { css } from 'glamor'

class Header extends React.Component {
  render () {
    return (
      <Headroom>
        <div
          css={{
            height: rhythm(2),
            lineHeight: rhythm(2),
            background: colors.sunny,
          }}
        >
          <SiteMargin>
            <div
              css={{
                padding: `0 ${rhythm(1/2)}`,
              }}
            >
              <Link
                to={prefixLink('/')}
              >
                KRASA
              </Link>
              <Link
                css={{
                  float: 'right',
                  marginLeft: rhythm(1/2),
                }}
                to={prefixLink('/blog/')}
              >
                BLOG
              </Link>
              <span
                css={{ float: 'right' }}
              >
                <ContactModal />
              </span>
            </div>
          </SiteMargin>
        </div>
      </Headroom>
    )
  }
}

Header.propTypes = {
}

export default Header
