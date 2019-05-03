import { asAbsolutePath } from "utils";

export async function getStylesheets(): Promise<string[]> {
	if (atom.packages.isPackageActive("codestream") === false) {
		await new Promise(resolve =>
			atom.packages.onDidActivatePackage(pkg => {
				if (pkg.name === "codestream") resolve();
			})
		);
	}

	const styles = atom.styles.getStyleElements();

	const [atomStyles, editorStyles, ...rest] = styles;
	const [uiStyles, syntaxStyles] = rest.reverse();

	const csStyles = atom.themes.loadLessStylesheet(
		asAbsolutePath("/dist/webview/styles/webview.less")
	);
	if (!csStyles) {
		throw new Error("CodeStream stylesheets are unavailable");
	}

	return [
		atomStyles.innerText,
		editorStyles.innerText,
		uiStyles.innerText,
		syntaxStyles.innerText,
		csStyles,
	];
}
