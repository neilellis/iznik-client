const HtmlWebpackPlugin = require('html-webpack-plugin');
const FaviconsPlugin = require('favicons-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const webpack = require('webpack');
const { Config } = require('webpack-config');
const { join } = require('path');

const ROOT = join(__dirname, '..');

module.exports = new Config().extend('dev/webpack.base.config.js').merge({
  devtool: 'source-map',
  entry: [join(ROOT, 'client/appfd.js')],
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: {
            loader: 'css-loader',
            options: {
              root: '../'
            }
          }
        })
      }
    ]
  },
  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      reportFilename: 'bundlesize.html',
      defaultSizes: 'gzip',
      openAnalyzer: false,
      generateStatsFile: false,
      statsFilename: 'stats.json',
      statsOptions: null,
      logLevel: 'info'
    }),
    new ExtractTextPlugin({
      filename: 'css/[name].[contenthash].css'
    }),
    new FaviconsPlugin('images/user_logo.png'),
    new webpack.DefinePlugin({
      FACEBOOK_APPID: JSON.stringify('134980666550322'),
      FACEBOOK_GRAFFITI_APPID: JSON.stringify('115376591981611'),
      GOOGLE_CLIENT_ID: JSON.stringify(
        '423761283916-1rpa8120tpudgv4nf44cpmlf8slqbf4f.apps.googleusercontent.com'
      ),
      SITE_NAME: JSON.stringify('Freegle'),
      SITE_DESCRIPTION: JSON.stringify(
        "Give and get stuff for free in your local community.  Don't just recycle - reuse, freecycle and freegle!"
      ),
      MODTOOLS: false
    }),
    new HtmlWebpackPlugin({
      hash: true,
      template: join(ROOT, 'client/index.ejs'),
      filename: 'index.html',
      inject: true,
      minify: {
        removeComments: true,
        collapseWhitespace: true,
        removeAttributeQuotes: true
        // more options:
        // https://github.com/kangax/html-minifier#options-quick-reference
      },
      // necessary to consistently work with multiple chunks via CommonsChunkPlugin
      chunksSortMode: 'dependency'
    }),

    new webpack.optimize.UglifyJsPlugin({
      sourceMap: true,
      minimize: true,
      compress: {
        warnings: false
      }
    }),

    // split vendor js into its own file
    new webpack.optimize.CommonsChunkPlugin({
      name: 'vendor',
      minChunks: function(module, count) {
        // any required modules inside node_modules are extracted to vendor
        return (
          module.resource &&
          /\.js$/.test(module.resource) &&
          (module.resource.indexOf('quasar') > -1 ||
            module.resource.indexOf(join(__dirname, '../node_modules')) === 0)
        );
      }
    }),

    // Do some cool async chunk loading, see:
    //   https://webpack.js.org/plugins/commons-chunk-plugin/#extra-async-commons-chunk
    //   https://medium.com/webpack/webpack-bits-getting-the-most-out-of-the-commonschunkplugin-ab389e5f318
    new webpack.optimize.CommonsChunkPlugin({
      children: true,
      async: true,
      minChunks: 3
    }),

    // extract webpack runtime and module manifest to its own file in order to
    // prevent vendor hash from being updated whenever app bundle is updated
    new webpack.optimize.CommonsChunkPlugin({
      name: 'manifest',
      chunks: ['vendor']
    }),

    // do scope hoisting: https://webpack.js.org/plugins/module-concatenation-plugin
    // should reduce scripting time and bundle size
    new webpack.optimize.ModuleConcatenationPlugin()
  ]
});
