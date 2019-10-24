import { readableColor } from "polished";

export type PropsWithTheme<P = any> = { theme: CSTheme } & P;

export const lightTheme: CSTheme = {
	colors: {
		text: "black",
		appBackground: "white",
		baseBackground: "white",
		grey1: "#c4c4c4",
		grey2: "#787878",
		white: "#ffffff",
		success: "#7aba5d",
		error: "#d9634f"
	},
	fontSizes: {
		normal: "16px",
		small: "14px",
		large: "18px"
	}
};

export const darkTheme: CSTheme = {
	colors: {
		text: "rgb(220, 223, 228)",
		appBackground: "#1e1e1e",
		baseBackground: "#1e1e1e",
		grey1: "#6c757d",
		grey2: "#343a40",
		white: "#f8f9fa",
		success: "#7aba5d",
		error: "#d9634f"
	},
	fontSizes: {
		normal: "16px",
		small: "14px",
		large: "18px"
	}
};

export interface CSTheme {
	fontSizes: {
		normal: string;
		small: string;
		large: string;
	};
	colors: {
		text: string;
		appBackground: string;
		baseBackground: string;
		success: string;
		error: string;
		grey1: string;
		grey2: string;
		white: string;
	};
}

export function isDark(color: string) {
	return JSON.parse(readableColor(color, "false", "true"));
}

export function createTheme(): CSTheme {
	const computedStyle = getComputedStyle(document.body);
	const fontSize = parseValue(computedStyle.getPropertyValue("--font-size").trim());

	return {
		colors: {
			...darkTheme.colors,
			text: computedStyle.getPropertyValue("--text-color").trim() || darkTheme.colors.text,
			appBackground:
				computedStyle.getPropertyValue("--app-background-color").trim() ||
				darkTheme.colors.appBackground,
			baseBackground:
				computedStyle.getPropertyValue("--base-background-color").trim() ||
				darkTheme.colors.baseBackground
		},
		fontSizes: {
			large: `${fontSize + 2}px`,
			normal: `${fontSize}px`,
			small: `${fontSize - 2}px`
		}
	};
}

function parseValue(str: string): number {
	const [value] = str.match(/(\d+)/) || ["0"];

	return parseInt(value, 10);
}
