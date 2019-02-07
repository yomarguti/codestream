"use strict";
const fs = require("fs");
const path = require("path");
const CleanPlugin = require("clean-webpack-plugin");
const FileManagerPlugin = require("filemanager-webpack-plugin");
const HtmlPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = function(env, argv) {
	env = env || {};
	env.production = Boolean(env.production);
	env.watch = Boolean(argv.watch || argv.w);

	env.copyShared = Boolean(env.copyShared);
	if (
		!env.copyShared &&
		!fs.existsSync(path.resolve(__dirname, "../codestream-components/shared"))
	) {
		env.copyShared = true;
	}

	let onStart = [];
	if (!env.watch && env.copyShared) {
		onStart.push({
			copy: [
				// Copy in the type declarations from the agent, because referencing them directly is a nightmare
				{
					// TODO: Use environment variable if exists
					source: path.resolve(__dirname, "../codestream-lsp-agent/src/shared/*"),
					destination: path.resolve(__dirname, "../codestream-components/shared/")
				}
			]
		});
	}

	const plugins = [
		new CleanPlugin(["src/CodeStream.VisualStudio/UI/WebViews/dist"]),
		new FileManagerPlugin({
			onStart: onStart
		}),
		new MiniCssExtractPlugin({
			filename: "webview.css"
		}),
		new HtmlPlugin({
			template: "index.html",
			filename: "webview.html",
			inject: true,
			minify: env.production
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
		name: "webview",
		context: path.resolve(__dirname, "src/CodeStream.VisualStudio/UI/WebViews"),
		entry: {
			webview: ["./index.js", "./styles/webview.less"]
		},
		mode: env.production ? "production" : "development",
		devtool: !env.production ? "eval-source-map" : undefined,
		output: {
			filename: "[name].js",
			path: path.resolve(__dirname, "src/CodeStream.VisualStudio/UI/WebViews/dist"),
			publicPath: "file:///{root}/UI/WebViews/dist/"
		},
		module: {
			rules: [
				{
					test: /\.html$/,
					use: "html-loader"
				},
				{
					test: /\.jsx?$/,
					use: "babel-loader",
					exclude: /node_modules/
				},
				{
					test: /\.tsx?$/,
					use: "ts-loader",
					exclude: /node_modules|\.d\.ts$/
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
								sourceMap: !env.production,
								url: false
							}
						},
						{
							loader: "less-loader",
							options: {
								sourceMap: !env.production
							}
						}
					],
					exclude: /node_modules/
				}
			]
		},
		resolve: {
			extensions: [".ts", ".tsx", ".js", ".jsx"],
			modules: [path.resolve(__dirname, "src/CodeStream.VisualStudio/UI/WebViews"), "node_modules"],
			alias: {
				// TODO: Use environment variable if exists
				"codestream-components$": path.resolve(__dirname, "../codestream-components/index.ts"),
				"codestream-components": path.resolve(__dirname, "../codestream-components/")
			}
		},
		node: {
			net: "mock"
		},
		plugins: plugins,
		stats: {
			all: false,
			assets: true,
			builtAt: true,
			env: true,
			errors: true,
			timings: true,
			warnings: true
		}
	};
};
