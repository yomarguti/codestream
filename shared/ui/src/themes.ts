export type PropsWithTheme<P = any> = { theme: CSTheme } & P;

export const defaultTheme: CSTheme = {
	colors: {
		text: "black",
		grey1: "#c4c4c4",
		grey2: "#787878",
		white: "#ffffff",
		success: "#7aba5d",
		error: "#d9634f"
	}
	// fontSizes: {
	// 	normal: "16px",
	// 	small: "14px",
	// 	large: "18px"
	// }
};

export interface CSTheme {
	// fontSizes: {
	// 	normal: string;
	// 	small: string;
	// 	large: string;
	// };
	colors: {
		text: string;
		success: string;
		error: string;
		grey1: string;
		grey2: string;
		white: string;
	};
}

// export function createTheme(): CSTheme {
// 	const computedStyle = getComputedStyle(document.body);
// 	const fontSize = parseValue(computedStyle.getPropertyValue("--font-size").trim());
//
// 	console.log("fontSize", fontSize);
// 	return {
// 		...defaultTheme,
// 		fontSizes: {
// 			large: `${fontSize + 2}px`,
// 			normal: `${fontSize}px`,
// 			small: `${fontSize - 2}px`
// 		}
// 	};
// }
//
// function parseValue(str: string): number {
// 	const [value] = str.match(/(\d+)/) || ["0"];
//
// 	return parseInt(value, 10);
// }
