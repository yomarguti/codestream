import { CompositeDisposable, Disposable, watchPath } from "atom";
import * as fs from "fs-plus";
import { asAbsolutePath, Debug, Echo } from "utils";

export class StylesProvider implements Disposable {
	readonly webviewStylesPath = asAbsolutePath("/dist/webview/styles/webview.less");
	readonly codestreamComponentsStylesDir = asAbsolutePath("../codestream-components/styles");
	readonly distComponentsStylesDir = asAbsolutePath("dist/webview/styles/");
	readonly webviewLibStylesPath = asAbsolutePath("/webview-lib/webview.less");
	private changeEmitter = new Echo<string[]>();

	private subscriptions = new CompositeDisposable();

	private _csStyles: string = "";
	get csStyles() {
		return this._csStyles;
	}

	private _atomStyles: string[] = [];
	get atomStyles() {
		return this._atomStyles;
	}

	static create() {
		const provider = new StylesProvider();
		provider.initialize();
		return provider;
	}

	readonly readyPromise: Promise<void>;

	private constructor() {
		this.readyPromise = new Promise(resolve => {
			const disposable = atom.packages.onDidActivatePackage(pkg => {
				if (pkg.name === "codestream") {
					this.buildStyles();
					resolve();
					disposable.dispose();
				}
			});
		});
	}

	protected initialize() {
		this.subscriptions.add(
			atom.themes.onDidChangeActiveThemes(async () => {
				this.buildStyles();
				this.notifyListeners();
			})
		);
		if (Debug.isDebugging()) {
			fs.exists(this.codestreamComponentsStylesDir, async exists => {
				if (exists) {
					this.subscriptions.add(
						await watchPath(this.codestreamComponentsStylesDir, {}, _events => {
							try {
								fs.copySync(this.codestreamComponentsStylesDir, this.distComponentsStylesDir);
								this.buildCSStyles();
								this.notifyListeners();
							} catch (error) {
								atom.notifications.addError(
									"CodeStream: could not copy codestream-components styles into `dist/`",
									{
										dismissable: true,
										detail: error.message,
									}
								);
							}
						}),
						await watchPath(this.webviewLibStylesPath, {}, _events => {
							fs.copyFile(this.webviewLibStylesPath, this.webviewStylesPath, error => {
								if (error) {
									return atom.notifications.addError(
										"CodeStream: could not copy styles into `dist/`",
										{
											dismissable: true,
											detail: error.message,
										}
									);
								}
								this.buildCSStyles();
								this.notifyListeners();
							});
						})
					);
				}
			});
		}
	}

	dispose() {
		this.subscriptions.dispose();
	}

	onDidChange(cb: (stylesheets: string[]) => void) {
		return this.changeEmitter.add(cb);
	}

	private async notifyListeners() {
		this.changeEmitter.push(await this.getStylesheets());
	}

	buildStyles() {
		this.buildCSStyles();
		this.buildAtomStyles();
	}

	buildCSStyles() {
		try {
			this._csStyles = atom.themes.loadLessStylesheet(this.webviewStylesPath, true);
		} catch (error) {
			if (Debug.isDebugging) {
				console.error(error);
				atom.notifications.addError("There was an error compiling stylesheets");
				debugger;
			}
		}
	}

	buildAtomStyles() {
		const styles = atom.styles.getStyleElements();

		const [atomStyles, editorStyles, ...rest] = styles;
		const [uiStyles, syntaxStyles] = rest.reverse();

		const computedStyle = getComputedStyle(document.body);

		this._atomStyles = [
			`body {
				--font-size: ${computedStyle.getPropertyValue("font-size").trim()};
				--font-weight: ${computedStyle.getPropertyValue("font-weight").trim()};
			}`,
			atomStyles.innerHTML,
			editorStyles.innerHTML,
			uiStyles.innerHTML,
			syntaxStyles.innerHTML,
		];
	}

	async getStylesheets() {
		await this.readyPromise;
		return [...this.atomStyles, this.csStyles];
	}
}
