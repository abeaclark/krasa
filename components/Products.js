import React from 'react'
import { rhythm } from 'utils/typography'
import { prefixLink } from 'gatsby-helpers'
import { getViewportWidth, getViewportHeight } from 'utils/helpers'
import { colors } from 'utils/colors'
import { Link } from 'react-router'
import logo from '../media/logo.png'
import MainLabel from 'components/MainLabel'
import ProductThumbnail from 'components/ProductThumbnail'

class Products extends React.Component {
  render () {
    const products = this.props.products
    console.log(products)
    const productElements = []
    products.forEach((product) => {
      if (product.node.path !== '/404/') {
        productElements.push(
          <ProductThumbnail
            key={product.node.path}
            title={product.node.frontmatter.title}
            price={product.node.frontmatter.price}
            attributes={product.node.frontmatter.attributes}
            photoURL={product.node.frontmatter.photoURL}
          />
        )
      }
    })
    console.log(productElements)
    console.log(products)
    return (
      <div
        style={{
          minHeight: '100vh',
          position: 'relative',
          display: 'flex',
          padding: rhythm(1),
        }}
      >
        <div style={{border: '1px solid gray', width: '100%', minHeight: '90vh', padding: rhythm(2), }}>
          <MainLabel />
          {productElements}
        </div>
      </div>
    )
  }
}

Products.propTypes = {
}

export default Products
