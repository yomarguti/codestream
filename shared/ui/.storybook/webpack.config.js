module.exports = ({ config }) => {
	config.module.rules.push({
		test: /\.(ts|tsx)$/,
		loader: require.resolve("babel-loader"),
		options: {
			plugins: ["babel-plugin-styled-components"],
			presets: [["react-app", { flow: false, typescript: true }]]
		}
	});
	config.resolve.extensions.push(".ts", ".tsx");
	return config;
};
