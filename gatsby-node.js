import _ from 'lodash'
import Promise from 'bluebird'
import path from 'path'
import webpack from 'webpack'

exports.rewritePath = (parsedFilePath, metadata) => {
  if (parsedFilePath.ext === 'md') {
    return `/${parsedFilePath.dirname.split('---')[1]}/`
  }
}

exports.createPages = ({ graphql }) => (
  new Promise((resolve, reject) => {
    const pages = []
    const blogDetail = path.resolve('./page-templates/blog-detail.js')
    graphql(`
      {
        allMarkdown(first: 1000) {
          edges {
            node {
              path
              frontmatter {
                author
              }
            }
          }
        }
      }
    `)
    .then(result => {
      if (result.errors) {
        console.log(result.errors)
        reject(result.errors)
      }

      // Create blog posts pages.
      _.each(result.data.allMarkdown.edges, (edge) => {
        if (edge.node.path !== '/404/') {
          pages.push({
            path: edge.node.path,
            author: edge.node.frontmatter.author,
            component: blogDetail,
          })
        }
      })

      console.log(pages)
      resolve(pages)
    })
  })
)

exports.modifyWebpackConfig = (config, stage) => {
  config.plugin('Glamor', webpack.ProvidePlugin, [{
    Glamor: 'glamor/react',
  }])
  return config
}
