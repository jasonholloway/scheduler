var path = require('path');
var webpack = require('webpack');
 
module.exports = {
  debug: true,
  devtool: 'cheap-source-map',
  entry: './main.jsx',
  output: { path: __dirname, filename: 'bundle.js' },
  module: {
    loaders: [
      {
        test: /.jsx?$/,
        loader: 'babel-loader',
        exclude: [/node_modules/, /bower_components/, /typings/],
        query: {
          presets: ['es2015', 'react']
        }
      }
    ]
  },
};