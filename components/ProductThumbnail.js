import React from 'react'
import { rhythm } from 'utils/typography'
import { colors } from 'utils/colors'

class ProductThumbnail extends React.Component {
  render () {
    return (
        <div 
          style={{
          }}
        >
        lkasjdf
          {this.props.title}
          {this.props.price}
          {this.props.attributes}
          {this.props.photoURL}
      </div>
    )
  }
}

ProductThumbnail.propTypes = {
  title: React.PropTypes.string,
  price: React.PropTypes.integer,
  attributes: React.PropTypes.array,
  photoURL: React.PropTypes.string,
}

export default ProductThumbnail
