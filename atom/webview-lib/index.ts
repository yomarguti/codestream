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
	if (data.label === "update-styles") {
		// TODO: clear out the existing ones?
		setStyles(data.styles);
	}
});

document.addEventListener(
	"click",
	(e: MouseEvent) => {
		if (e == null || e.target == null || (e.target as Element).tagName !== "A") return;

		const target = e.target as HTMLAnchorElement;
		if (target.href) {
			window.postMessage({ label: "open-link", link: target.href }, "*");
			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();
		}
	},
	true
);
