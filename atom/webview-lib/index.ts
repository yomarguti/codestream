import { initialize, setupCommunication } from "@codestream/webview/index";

const setStyles = (stylesheets: string[]) => {
	const stylesDiv = document.querySelector("#styles")!;
	stylesDiv.innerHTML = "";
	stylesheets.forEach((stylesheet: string) => {
		const style = document.createElement("style");
		style.innerText = stylesheet;
		stylesDiv.appendChild(style);
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
