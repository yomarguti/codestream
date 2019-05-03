import { initialize, setupCommunication } from "@codestream/webview/index";

const lightClass = "vscode-light";
const darkClass = "vscode-dark";

const setStyles = (stylesheets: string[]) => {
	const stylesContainer = document.querySelector("codestream-styles")!;
	stylesheets.forEach((stylesheet: string) => {
		const style = document.createElement("style");
		style.innerText = stylesheet;
		stylesContainer.appendChild(style);
	});

	const computedStyle = getComputedStyle(document.body);
	const [set, remove] =
		computedStyle.getPropertyValue("--in-dark-mode").trim() === "true"
			? [darkClass, lightClass]
			: [lightClass, darkClass];

	document.body.classList.remove(remove);
	document.body.classList.add(set);
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
