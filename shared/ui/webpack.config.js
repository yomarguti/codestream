"use strict";
const path = require("path");
// const BabelExternalHelpersPlugin = require("webpack-babel-external-helpers-2");
const CleanPlugin = require("clean-webpack-plugin");
const FileManagerWebpackPlugin = require("filemanager-webpack-plugin");

module.exports = function(env, argv) {
	env = env || {};
	const production = !!env.production;

	const plugins = [
		new CleanPlugin(["dist"]),
		// new BabelExternalHelpersPlugin(),
		new FileManagerWebpackPlugin({
			onStart: [
				{
					copy: [
						{
							source: "styles/*",
							destination: path.resolve(__dirname, "dist/styles")
						},
						{
							source: "translations/*",
							destination: path.resolve(__dirname, "dist/translations")
						}
					]
				}
			],
			onEnd: [
				{
					copy: [
						{
							source: "dist/*",
							// TODO: Use environment variable if exists
							destination: path.resolve(__dirname, "../vscode-codestream/dist/webview")
						}
					]
				}
			]
		})
	];

	return {
		entry: "./index.js",
		mode: production ? "production" : "development",
		target: "node",
		devtool: !production ? "eval-source-map" : undefined,
		output: {
			filename: "codestream-components.js"
		},
		optimization: {
			splitChunks: {
				chunks: "all"
			}
		},
		resolve: {
			extensions: [".jsx", ".js"]
		},
		module: {
			rules: [
				{
					test: /\.jsx?$/,
					use: "babel-loader",
					exclude: /node_modules/
				}
			]
		},
		plugins: plugins
	};
};
