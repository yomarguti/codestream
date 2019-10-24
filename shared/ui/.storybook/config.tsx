import * as React from "react";
import { configure, addDecorator } from "@storybook/react";
import { ThemeProvider } from "styled-components";
import { lightTheme, darkTheme } from "../src/themes";

configure(require.context("../src", true, /\.stories\.tsx$/), module);

addDecorator(story => <ThemeProvider theme={lightTheme}>{story()}</ThemeProvider>);
