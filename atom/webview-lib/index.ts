import { setupCommunication, initialize } from "@codestream/webview/index";

window.addEventListener("message", message => {
	setupCommunication(message.ports[0]);

	const { styles } = message.data;

	styles.forEach((stylesheet: string) => {
		const style = document.createElement("style");
		style.innerText = stylesheet;
		document.head.appendChild(style);
	});

	initialize("#app");
});
