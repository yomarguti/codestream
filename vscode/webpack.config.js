"use strict";
const fs = require("fs");
const path = require("path");
const CleanPlugin = require("clean-webpack-plugin");
const FileManagerPlugin = require("filemanager-webpack-plugin");
const HtmlPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin");
// const CircularDependencyPlugin = require("circular-dependency-plugin");
const BundleAnalyzerPlugin = require("webpack-bundle-analyzer").BundleAnalyzerPlugin;

module.exports = function(env, argv) {
	env = env || {};
	env.analyze = Boolean(env.analyze);
	env.analyzeWebview = Boolean(env.analyzeWebview);
	env.production = env.analyze || env.analyzeWebview || Boolean(env.production);
	env.reset = Boolean(env.reset);
	env.watch = Boolean(argv.watch || argv.w);

	const protocolPath = path.resolve(__dirname, "src/protocols");
	if (!fs.existsSync(protocolPath)) {
		fs.mkdirSync(protocolPath);
	}

	const agentSymlink = path.resolve(protocolPath, "agent");
	if (env.reset) {
		if (fs.existsSync(agentSymlink)) {
			fs.unlinkSync(agentSymlink);
		}
	}

	if (!fs.existsSync(agentSymlink)) {
		try {
			console.log("Creating extension symlink to the agent protocol folder...");

			fs.symlinkSync(
				path.resolve(__dirname, "../codestream-lsp-agent/src/protocol"),
				agentSymlink,
				"dir"
			);
		} catch (ex) {
			console.log(`Extension <-> Agent symlink failed; ${ex}`);
		}
	}

	const webviewSymlink = path.resolve(protocolPath, "webview");
	if (env.reset) {
		if (fs.existsSync(webviewSymlink)) {
			fs.unlinkSync(webviewSymlink);
		}
	}

	if (!fs.existsSync(webviewSymlink)) {
		try {
			console.log("Creating extension symlink to the webview protocol folder...");

			fs.symlinkSync(
				path.resolve(__dirname, "../codestream-components/ipc"),
				webviewSymlink,
				"dir"
			);
		} catch (ex) {
			console.log(`Extension <-> Webview symlink failed; ${ex}`);
		}
	}

	const webviewProtocolPath = path.resolve(__dirname, "../codestream-components/protocols");
	if (!fs.existsSync(webviewProtocolPath)) {
		fs.mkdirSync(webviewProtocolPath);
	}

	const webviewAgentSymlink = path.resolve(webviewProtocolPath, "agent");
	if (env.reset) {
		if (fs.existsSync(webviewAgentSymlink)) {
			fs.unlinkSync(webviewAgentSymlink);
		}
	}

	if (!fs.existsSync(webviewAgentSymlink)) {
		try {
			console.log("Creating webview symlink to the agent protocol folder...");

			fs.symlinkSync(
				path.resolve(__dirname, "../codestream-lsp-agent/src/protocol"),
				webviewAgentSymlink,
				"dir"
			);
		} catch (ex) {
			console.log(`Webview <-> Agent symlink failed; ${ex}`);
		}
	}

	// TODO: Total and complete HACK until the following vsls issues are resolved
	// https://github.com/MicrosoftDocs/live-share/issues/1334 & https://github.com/MicrosoftDocs/live-share/issues/1335

	const vslsPatchRegex = /const liveShareApiVersion = require\(path\.join\(__dirname, 'package\.json'\)\)\.version;/;

	let vslsPath = path.resolve(__dirname, "node_modules/vsls/package.json");
	if (fs.existsSync(vslsPath)) {
		const vsls = require(vslsPath);
		if (vsls.main === undefined) {
			console.log("Fixing vsls package; Adding missing main to package.json...");

			vsls.main = "vscode.js";
			fs.writeFileSync(vslsPath, `${JSON.stringify(vsls, undefined, 4)}\n`, "utf8");
		}

		vslsPath = path.resolve(__dirname, "node_modules/vsls/vscode.js");
		if (fs.existsSync(vslsPath)) {
			let code = fs.readFileSync(vslsPath, "utf8");
			if (vslsPatchRegex.test(code)) {
				console.log("Fixing vsls package; Removing version lookup...");

				code = code.replace(
					vslsPatchRegex,
					`const liveShareApiVersion = '${
						vsls.version
					}'; // require(path.join(__dirname, 'package.json')).version;`
				);
				console.log(code);
				fs.writeFileSync(vslsPath, code, "utf8");
			}
		}
	}

	return [getExtensionConfig(env), getWebviewConfig(env)];
};

function getExtensionConfig(env) {
	const plugins = [
		new CleanPlugin(["dist/agent*", "dist/extension*"], { verbose: false }),
		new FileManagerPlugin({
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
		// new CircularDependencyPlugin({
		// 	exclude: /node_modules/,
		// 	failOnError: false,
		// 	cwd: __dirname
		// })
	];

	if (env.analyze) {
		plugins.push(new BundleAnalyzerPlugin());
	}

	return {
		name: "extension",
		entry: "./src/extension.ts",
		mode: env.production ? "production" : "development",
		target: "node",
		node: {
			__dirname: false
		},
		devtool: "source-map",
		output: {
			libraryTarget: "commonjs2",
			filename: "extension.js"
		},
		optimization: {
			minimizer: [
				new TerserPlugin({
					cache: true,
					parallel: true,
					sourceMap: true,
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
			plugins: [new TsconfigPathsPlugin()],
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
}

function getWebviewConfig(env) {
	const plugins = [
		new CleanPlugin(["dist/webview", "webview.html"]),
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

	if (env.analyzeWebview) {
		plugins.push(new BundleAnalyzerPlugin());
	}

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
			modules: [path.resolve(__dirname, "src/webviews/app"), "node_modules"],
			alias: {
				"@codestream/webview": path.resolve(__dirname, "../codestream-components/"),
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
				)
			},
			// Treats symlinks as real files -- using their "current" path
			symlinks: false
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
}
