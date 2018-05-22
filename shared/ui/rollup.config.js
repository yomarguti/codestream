import babel from "rollup-plugin-babel";
import resolve from "rollup-plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";

export default {
  input: "index.js",
  output: {
    file: "dist/index.js",
    format: "cjs"
  },
  plugins: [
    resolve({
      module: true,
      jsnext: true,
      main: true,
      extensions: [".js", ".json"],
      preferBuiltins: false
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
        ]
      }
    }),
    babel({
      exclude: "node_modules/**"
    })
  ]
};
