const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: './src/js/index.js',
  output: {
    filename: 'croptastic.js',
    path: path.resolve(__dirname, 'dist')
  },
  plugins: [
    new webpack.ProvidePlugin({
      $: 'jquery', // eslint-disable-line quote-props
      jQuery: 'jquery', // eslint-disable-line quote-props
      'window.jQuery': 'jquery',
      'window.$': 'jquery'
    })
  ],
  module: {
    rules: [
      {
        test: /\.(jpe?g|png|gif)$/i,
        loader: 'file-loader',
        query: {
          name: '[name].[ext]',
          outputPath: 'images/'
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  }
};
