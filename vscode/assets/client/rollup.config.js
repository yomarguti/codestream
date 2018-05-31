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
			delimiters: ["", ""]
		}),
		resolve({
			module: true,
			jsnext: true,
			main: true,
			extensions: [".js", ".json"],
			preferBuiltins: false
		}),
		babel({
			exclude: "node_modules/**"
		}),
		commonjs({
			extensions: [".js", ".json"],
			namedExports: {
				"node_modules/react/index.js": [
					"Component",
					"Children",
					"createElement",
					"Fragment",
					"isValidElement",
					"PureComponent"
				]
			}
		})
	]
};
