"use strict";
const fs = require("fs");
const path = require("path");
// const BabelExternalHelpersPlugin = require("webpack-babel-external-helpers-2");
const CleanPlugin = require("clean-webpack-plugin");
const FileManagerPlugin = require("filemanager-webpack-plugin");
const HtmlPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const TerserPlugin = require("terser-webpack-plugin");

module.exports = function(env, argv) {
	env = env || {};
	env.production = Boolean(env.production);
	env.watch = Boolean(argv.watch || argv.w);

	env.copyShared = Boolean(env.copyShared);
	if (!env.copyShared && !fs.existsSync(path.resolve(__dirname, "src/shared"))) {
		env.copyShared = true;
	}

	return [getExtensionConfig(env), getWebviewConfig(env)];
};

function getExtensionConfig(env) {
	let onStart = [];
	// TODO: Need to figure out why webpack isn't waiting for the copy to be completed
	// See https://github.com/gregnb/filemanager-webpack-plugin/issues/47
	if (!env.watch && env.copyShared) {
		onStart.push({
			copy: [
				// Copy in the type declarations from the agent, because referencing them directly is a nightmare
				{
					// TODO: Use environment variable if exists
					source: path.resolve(__dirname, "../codestream-lsp-agent/src/shared/*"),
					destination: "src/shared/"
				}
			]
		});
	}

	const plugins = [
		new CleanPlugin(["dist"], { verbose: false }),
		new FileManagerPlugin({
			onStart: onStart,
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
		node: {
			__dirname: false
		},
		devtool: !env.production ? "source-map" : undefined,
		output: {
			libraryTarget: "commonjs2",
			filename: "extension.js",
			devtoolModuleFilenameTemplate: "file:///[absolute-resource-path]"
		},
		optimization: {
			minimizer: [
				new TerserPlugin({
					cache: true,
					parallel: true,
					sourceMap: env.production,
					terserOptions: {
						ecma: 8,
						// Keep the class names otherwise @log won't provide a useful name
						keep_classnames: true,
						module: true
					}
				})
			]
		},
		externals: {
			vscode: "commonjs vscode"
		},
		module: {
			rules: [
				{
					test: /\.ts$/,
					enforce: "pre",
					use: "tslint-loader",
					exclude: /node_modules/
				},
				{
					test: /\.tsx?$/,
					use: "ts-loader",
					exclude: /node_modules|\.d\.ts$/
				}
			],
			// Removes `Critical dependency: the request of a dependency is an expression` from `./node_modules/vsls/vscode.js`
			exprContextRegExp: /^$/,
			exprContextCritical: false
		},
		resolve: {
			extensions: [".ts", ".tsx", ".js", ".jsx"],
			alias: {
				"node-fetch": path.resolve(__dirname, "node_modules/node-fetch/lib/index.js"),
				"vsls/vscode": path.resolve(__dirname, "node_modules/vsls/vscode.js")
			}
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
		devtool: !env.production ? "source-map" : undefined,
		output: {
			filename: "[name].js",
			path: path.resolve(__dirname, "dist/webview"),
			publicPath: "{{root}}/dist/webview/"
		},
		optimization: {
			minimizer: [
				new TerserPlugin({
					cache: true,
					parallel: true,
					sourceMap: env.production
				})
			],
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
								minimize: env.production,
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
			modules: [path.resolve(__dirname, "src/webviews/app"), "node_modules"],
			alias: {
				// TODO: Use environment variable if exists
				"codestream-components$": path.resolve(__dirname, "../codestream-components/index.js"),
				"codestream-components": path.resolve(__dirname, "../codestream-components/")
			}
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
}
