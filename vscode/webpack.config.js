"use strict";
const path = require("path");
const nodeExternals = require("webpack-node-externals");
// const BabelExternalHelpersPlugin = require("webpack-babel-external-helpers-2");
const CleanPlugin = require("clean-webpack-plugin");
const FileManagerPlugin = require("filemanager-webpack-plugin");
const HtmlPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = function(env, argv) {
	env = env || {};
	env.production = !!env.production;
	env.watch = !!(argv.watch || argv.w);

	return [getExtensionConfig(env), getWebviewConfig(env)];
};

function getExtensionConfig(env) {
	let clean = ["dist"];
	let onStartCopy = [];
	if (!env.watch) {
		clean.push("src/shared");
		onStartCopy.push(
			// Copy in the type declarations from the agent, because referencing them directly is a nightmare
			{
				// TODO: Use environment variable if exists
				source: path.resolve(__dirname, "../codestream-lsp-agent/src/shared/*"),
				destination: "src/shared/"
			}
		);
	}

	const plugins = [
		new CleanPlugin(clean),
		new FileManagerPlugin({
			onStart: [{ copy: onStartCopy }],
			onEnd: [
				{
					copy: [
						{
							// TODO: Use environment variable if exists
							source: path.resolve(__dirname, "../codestream-lsp-agent/dist/*"),
							destination: "dist/"
						},
						{
							source: path.resolve(__dirname, "codestream-*.info"),
							destination: "dist/"
						}
					]
				}
			]
		})
	];

	return {
		name: "extension",
		entry: "./src/extension.ts",
		mode: env.production ? "production" : "development",
		target: "node",
		devtool: !env.production ? "eval-source-map" : undefined,
		output: {
			libraryTarget: "commonjs2",
			filename: "extension.js",
			devtoolModuleFilenameTemplate: "file:///[absolute-resource-path]"
		},
		resolve: {
			extensions: [".tsx", ".ts", ".js"]
		},
		externals: [nodeExternals()],
		module: {
			rules: [
				{
					test: /\.ts$/,
					enforce: "pre",
					use: "tslint-loader"
				},
				{
					test: /\.tsx?$/,
					use: "ts-loader",
					exclude: /node_modules|\.d\.ts$/
				},
				{
					test: /\.d\.ts$/,
					loader: "ignore-loader"
				}
			]
		},
		plugins: plugins,
		stats: { all: false, assets: true, builtAt: true, errors: true, timings: true, warnings: true }
	};
}

function getWebviewConfig(env) {
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
		context: path.resolve(__dirname, "src/webviews/app"),
		entry: {
			webview: ["./index.js", "./styles/webview.less"]
		},
		mode: env.production ? "production" : "development",
		devtool: !env.production ? "eval-source-map" : undefined,
		output: {
			filename: "[name].js",
			path: path.resolve(__dirname, "dist/webview"),
			publicPath: "{{root}}/dist/webview/"
		},
		optimization: {
			splitChunks: {
				chunks: "all",
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
			modules: [path.resolve(__dirname, "src/webviews/app"), "node_modules"],
			alias: {
				// TODO: Use environment variable if exists
				"codestream-components$": path.resolve(__dirname, "../codestream-components/index.js"),
				"codestream-components": path.resolve(__dirname, "../codestream-components/")
			}
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
					test: /\.less$/,
					use: [
						{
							loader: MiniCssExtractPlugin.loader
						},
						{
							loader: "css-loader",
							options: {
								minimize: env.production,
								sourceMap: !env.production,
								url: false
							}
						},
						{
							loader: "less-loader",
							options: {
								// Turn off sourceMap because of https://github.com/less/less.js/issues/3300
								sourceMap: false //!production
							}
						}
					],
					exclude: /node_modules/
				}
			]
		},
		plugins: plugins,
		stats: { all: false, assets: true, builtAt: true, errors: true, timings: true, warnings: true }
	};
}
