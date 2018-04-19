import babel from "rollup-plugin-babel";
// import uglify from "rollup-plugin-uglify";
import resolve from "rollup-plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";
import replace from "rollup-plugin-replace";

export default {
	input: "lib/codestream-vs.js",
	output: {
		file: "../app.js",
		format: "iife",
		globals: { atom: "" }
	},
	plugins: [
		replace({
			"process.env.NODE_ENV": JSON.stringify("development"),
			'sessionStorage.getItem("codestream.env")': JSON.stringify("dev"),
			'sessionStorage.getItem("codestream.url")': JSON.stringify(
				"https://pd-api.codestream.us:9443"
			),
			"typeof localStorage !== undefined": JSON.stringify(false),
			delimiters: ["", ""]
		}),
		resolve({
			module: true,
			jsnext: true,
			browser: true,
			main: true,
			extensions: [".js", ".json"],
			preferBuiltins: true
		}),
		commonjs({
			include: "node_modules/**",
			extensions: [".js", ".json"],
			namedExports: {
				"node_modules/react/index.js": [
					"Component",
					"Children",
					"createElement",
					"Fragment",
					"isValidElement",
					"PureComponent"
				],
				"node_modules/diff/dist/diff.js": ["structuredPatch", "parsePatch"]
			}
		}),
		babel({
			exclude: "node_modules/**"
		})
	]
};
