class VsCodeKeystrokeDispatcher {
	$root: Element | null;

	constructor() {
		this.$root = document.querySelector("body.codestream");
	}

	on(event: string, fn: (KeyboardEvent) => void) {
		if (this.$root) {
			this.$root.addEventListener(event, fn, { passive: true });
		}
		return {
			dispose: () => {
				this.$root && this.$root.removeEventListener("keydown", fn);
			}
		};
	}
}

const dispatcher = new VsCodeKeystrokeDispatcher();

export default dispatcher;
