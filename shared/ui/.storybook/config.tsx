import * as React from "react";
import addons from "@storybook/addons";
import { configure, addDecorator } from "@storybook/react";
import { ThemeProvider } from "styled-components";
import { lightTheme, darkTheme } from "../src/themes";

configure(require.context("../src", true, /\.stories\.tsx$/), module);

const channel = addons.getChannel();
let storybookIsDark = false;
channel.on("DARK_MODE", () => {
	storybookIsDark = true;
});

addDecorator(story => {
	const [isDark, setIsDark] = React.useState(storybookIsDark);

	React.useLayoutEffect(() => {
		channel.on("DARK_MODE", setIsDark);
		return () => channel.removeListener("DARK_MODE", setIsDark);
	}, [channel]);

	return <ThemeProvider theme={isDark ? darkTheme : lightTheme}>{story()}</ThemeProvider>;
});
