import * as React from "react";
import addons from "@storybook/addons";
import { configure, addDecorator } from "@storybook/react";
import { ThemeProvider } from "styled-components";
import { lightTheme, darkTheme } from "../src/themes";

configure(require.context("../src", true, /\.stories\.tsx$/), module);

const channel = addons.getChannel();

addDecorator(story => {
	const [isDark, setIsDark] = React.useState(false);

	React.useEffect(() => {
		channel.on("DARK_MODE", setIsDark);
		return () => (channel as any).off("DARK_MODE", setIsDark);
	}, [channel]);

	return <ThemeProvider theme={isDark ? darkTheme : lightTheme}>{story()}</ThemeProvider>;
});
