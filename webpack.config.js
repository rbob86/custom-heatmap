const path = require('path');

module.exports = {
  entry: './src/custom-heatmap.js',
  mode: 'production',
  output: {
    filename: 'custom-heatmap.js',
    path: path.resolve(__dirname, 'server/static'), // Ensure this matches your server's static directory
  },
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(woff|woff2|ttf|otf)$/,
        loader: 'url-loader',
      },
      {
        test: /\.(png|svg|jpg|gif)$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[path][name].[ext]',
            },
          },
        ],
      },
      {
        test: /\.json$/,
        type: 'javascript/auto',
        use: [
          {
            loader: 'json-loader'
          }
        ]
      }
    ],
  },
  watchOptions: {
    ignored: /dist/,
  },
};