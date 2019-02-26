"use strict";
const webpack = require("webpack");
const fs = require("fs");
const path = require("path");
const CleanPlugin = require("clean-webpack-plugin");
const FileManagerPlugin = require("filemanager-webpack-plugin");
const ForkTsCheckerPlugin = require("fork-ts-checker-webpack-plugin");
const HtmlPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin");
// const CircularDependencyPlugin = require("circular-dependency-plugin");
const BundleAnalyzerPlugin = require("webpack-bundle-analyzer").BundleAnalyzerPlugin;

module.exports = function(env, argv) {
	env = env || {};
	env.analyze = Boolean(env.analyze);
	env.production = env.analyze || Boolean(env.production);
	env.reset = Boolean(env.reset);
	env.watch = Boolean(argv.watch || argv.w);

	let protocolPath = path.resolve(__dirname, "src/protocols");
	if (!fs.existsSync(protocolPath)) {
		fs.mkdirSync(protocolPath);
	}

	console.log("Ensuring extension symlink to the agent protocol folder...");
	createFolderSymlinkSync(
		path.resolve(__dirname, "../codestream-lsp-agent/src/protocol"),
		path.resolve(protocolPath, "agent"),
		env
	);

	console.log("Ensuring extension symlink to the webview protocol folder...");
	createFolderSymlinkSync(
		path.resolve(__dirname, "../codestream-components/ipc"),
		path.resolve(protocolPath, "webview"),
		env
	);

	// console.log("Ensuring extension symlink to the webview folder...");
	// createFolderSymlinkSync(
	// 	path.resolve(__dirname, "../codestream-components"),
	// 	path.resolve(__dirname, "src/webviews/app/components"),
	// 	env
	// );

	protocolPath = path.resolve(__dirname, "../codestream-components/protocols");
	if (!fs.existsSync(protocolPath)) {
		fs.mkdirSync(protocolPath);
	}

	console.log("Ensuring webview symlink to the agent protocol folder...");
	createFolderSymlinkSync(
		path.resolve(__dirname, "../codestream-lsp-agent/src/protocol"),
		path.resolve(protocolPath, "agent"),
		env
	);

	const context = path.resolve(__dirname, "src/CodeStream.VisualStudio/UI/WebViews");

	const plugins = [
		new CleanPlugin(["src/CodeStream.VisualStudio/UI/WebViews/dist"]),
		new webpack.DefinePlugin(
			Object.assign(
				{ "global.atom": false },
				env.production ? { "process.env.NODE_ENV": JSON.stringify("production") } : {}
			)
		),
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
		}),
		new ForkTsCheckerPlugin({
			reportFiles: ["!index.tsx"]
		})
	];

	if (env.analyze) {
		plugins.push(new BundleAnalyzerPlugin());
	}

	return {
		name: "webview",
		context: context,
		entry: {
			webview: ["./index.tsx", "./styles/webview.less"]
		},
		mode: env.production ? "production" : "development",
		node: false,
		devtool: !env.production ? "eval-source-map" : undefined,
		output: {
			filename: "[name].js",
			path: path.resolve(__dirname, "src/CodeStream.VisualStudio/UI/WebViews/dist"),
			publicPath: "file:///{root}/UI/WebViews/dist/"
		},
		optimization: {
			minimizer: [
				new TerserPlugin({
					cache: true,
					parallel: true,
					sourceMap: true,
					terserOptions: {
						ecma: 8
					}
				})
			]
		},
		module: {
			rules: [
				{
					test: /\.html$/,
					use: "html-loader",
					exclude: /node_modules/
				},
				{
					test: /\.(js|ts)x?$/,
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
			extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
			alias: {
				"@codestream/protocols/agent": path.resolve(
					__dirname,
					"../codestream-components/protocols/agent/agent.protocol.ts"
				),
				"@codestream/protocols/api": path.resolve(
					__dirname,
					"../codestream-components/protocols/agent/api.protocol.ts"
				),
				"@codestream/protocols/webview": path.resolve(
					__dirname,
					"../codestream-components/ipc/webview.protocol.ts"
				),
				"@codestream/webview": path.resolve(__dirname, "../codestream-components/"),
				react: path.resolve(__dirname, "../codestream-components/node_modules/react"),
				"react-dom": path.resolve(__dirname, "../codestream-components/node_modules/react-dom"),
				"vscode-jsonrpc": path.resolve(__dirname, "../codestream-components/vscode-jsonrpc.shim.ts")
			},
			// Treats symlinks as real files -- using their "current" path
			symlinks: false
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

function createFolderSymlinkSync(source, target, env) {
	if (env.reset) {
		console.log("Unlinking symlink...");
		try {
			fs.unlinkSync(target);
		} catch (ex) {}
	} else if (fs.existsSync(target)) {
		return;
	}

	console.log("Creating symlink...");
	try {
		fs.symlinkSync(source, target, "dir");
	} catch (ex) {
		try {
			fs.unlinkSync(target);
			fs.symlinkSync(source, target, "dir");
		} catch (ex) {
			console.log(`Symlink creation failed; ${ex}`);
		}
	}
}
