import { initialize, setupCommunication } from "@codestream/webview/index";

const setStyles = (stylesheets: string[]) => {
	const stylesContainer = document.querySelector("codestream-styles")!;
	stylesheets.forEach((stylesheet: string) => {
		const style = document.createElement("style");
		style.innerText = stylesheet;
		stylesContainer.appendChild(style);
	});
};

window.addEventListener("message", ({ data, ports }) => {
	if (data.label === "codestream-webview-initialize") {
		setupCommunication(ports[0]);
		setStyles(data.styles);
		initialize("#app");
	}
	if ((data.label = "update-styles")) {
		setStyles(data.styles);
	}
});
