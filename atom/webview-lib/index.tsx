import { setupCommunication, initialize } from "@codestream/webview";

const start = Date.now();

window.addEventListener("message", message => {
	setupCommunication(message.ports[0]);

	const { styles } = message.data;

	styles.forEach((stylesheet: string) => {
		const style = document.createElement("style");
		style.innerText = stylesheet;
		document.head.appendChild(style);
	});

	initialize("#app", {
		prerender: () =>
			setTimeout(() => {
				document.body.classList.remove("preload");
			}, 1000), // Wait for animations to complete
	}).then(render => {
		const duration = Date.now() - start;
		if (duration < 250) {
			setTimeout(render, 250 - duration);
		} else {
			render();
		}
	});
});
