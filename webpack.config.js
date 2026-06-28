// webpack.config.js
// target: "electron-renderer" is REQUIRED — Lens/Electron provides React at
// runtime via globals, so we declare externals instead of bundling them.

const path = require("path");

/** @type {import('webpack').Configuration} */
module.exports = {
  mode: process.env.NODE_ENV === "production" ? "production" : "development",
  devtool: "source-map",

  // Single entry — renderer only, no main process entry
  entry: "./src/renderer.tsx",

  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "renderer.js",
    // Lens loads the extension as a CommonJS module
    libraryTarget: "commonjs2",
  },

  // Electron renderer target so Node built-ins resolve correctly
  target: "electron-renderer",

  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx"],
  },

  // These are provided by the Lens host process at runtime.
  // Bundling them would cause version conflicts and runtime crashes.
  externals: {
    react: "var React",
    "react-dom": "var ReactDOM",
    "@k8slens/extensions": "var LensExtensions",
  },

  module: {
    rules: [
      // TypeScript + TSX
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: {
          loader: "ts-loader",
          options: {
            transpileOnly: false, // full type-check during build
          },
        },
      },
      // CSS Modules — scoped class names, no collisions with Lens styles
      {
        test: /\.module\.css$/,
        use: [
          "style-loader",
          {
            loader: "css-loader",
            options: {
              modules: {
                localIdentName:
                  process.env.NODE_ENV === "production"
                    ? "[hash:base64:8]"
                    : "[local]__[hash:base64:5]",
              },
            },
          },
        ],
      },
    ],
  },
};
