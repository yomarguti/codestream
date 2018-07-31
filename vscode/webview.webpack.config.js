"use strict";
const path = require("path");
// const BabelExternalHelpersPlugin = require("webpack-babel-external-helpers-2");
const CleanPlugin = require("clean-webpack-plugin");
const HtmlPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = function(env, argv) {
	env = env || {};
	const production = !!env.production;

	const plugins = [
		new CleanPlugin(["dist/webview", "webview.html"]),
		// new BabelExternalHelpersPlugin(),
		new MiniCssExtractPlugin({
			filename: "webview.css"
		}),
		new HtmlPlugin({
			template: "index.html",
			filename: path.resolve(__dirname, "webview.html"),
			inject: true,
			minify: production
				? {
						removeComments: true,
						collapseWhitespace: true,
						removeRedundantAttributes: true,
						useShortDoctype: true,
						removeEmptyAttributes: true,
						removeStyleLinkTypeAttributes: true,
						keepClosingSlash: true
				  }
				: false
		})
	];

	return {
		context: path.resolve(__dirname, "src/webviews/app"),
		entry: {
			webview: ["./index.js", "./styles/vscode-stream.less"]
		},
		mode: production ? "production" : "development",
		devtool: !production ? "eval-source-map" : undefined,
		output: {
			filename: "[name].js",
			path: path.resolve(__dirname, "dist/app"),
			publicPath: "{{root}}/dist/app/"
		},
		optimization: {
			splitChunks: {
				cacheGroups: {
					styles: {
						name: "styles",
						test: /\.css$/,
						chunks: "all",
						enforce: true
					}
				}
			}
		},
		resolve: {
			extensions: [".tsx", ".ts", ".jsx", ".js"],
			modules: [path.resolve(__dirname, "src/webviews/app"), "node_modules"]
		},
		module: {
			rules: [
				{
					test: /\.html$/,
					use: "html-loader"
				},
				{
					test: /\.jsx?$/,
					use: ["babel-loader"],
					exclude: /node_modules/
				},
				{
					test: /\.less$/,
					use: [
						{
							loader: MiniCssExtractPlugin.loader
						},
						{
							loader: "css-loader",
							options: {
								minimize: production,
								sourceMap: !production,
								url: false
							}
						},
						{
							loader: "less-loader",
							options: {
								sourceMap: false //!production
							}
						}
					],
					exclude: /node_modules/
				}
			]
		},
		plugins: plugins
	};
};
