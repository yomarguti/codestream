import { GetDocumentFromMarkerRequestType } from "@codestream/protocols/agent";
import { CSMarker } from "@codestream/protocols/api";
import { Disposable, TextEditor } from "atom";
import { Convert } from "atom-languageclient";
import * as packageDeps from "atom-package-deps";
import * as path from "path";
import { SplitDiffService } from "types/package-services/split-diff";
import { createTempFile, Echo, isPackageInstalled } from "utils";
import { Container } from "./container";

export class DiffController implements Disposable {
	private _splitDiffService?: SplitDiffService;
	private splitDiffServiceInitEmitter = new Echo();

	constructor() {
		if (!isPackageInstalled("split-diff")) {
			packageDeps.install("codestream");
		}
	}

	set splitDiffService(service: SplitDiffService | undefined) {
		if (service !== undefined) {
			this.splitDiffServiceInitEmitter.push();
		}
		this._splitDiffService = service;
	}

	dispose() {
		this.splitDiffServiceInitEmitter.dispose();
	}

	async showDiff(marker: CSMarker) {
		if (this._splitDiffService === undefined) {
			if (atom.packages.isPackageDisabled("split-diff")) {
				atom.notifications.addWarning("The split-diff package is disabled", {
					description: "Please enable it to view codemark diffs",
				});
				return;
			}
			// TODO?: auto-reject this after some timeout to prevent leaks
			try {
				await new Promise(async (resolve, reject) => {
					const subscription = this.splitDiffServiceInitEmitter.add(() => {
						resolve();
						subscription.dispose();
					});
					await packageDeps.install("codestream");
					if (!isPackageInstalled("split-diff")) {
						reject();
					}
				});
			} catch (error) {
				atom.notifications.addInfo("installation canceled");
				return;
			}
		}

		const response = await Container.session.agent.request(GetDocumentFromMarkerRequestType, {
			markerId: marker.id,
			repoId: marker.repoId,
		});

		const currentEditor = atom.workspace.getActiveTextEditor()!;

		if (response === undefined) return;

		const diffPath = await createTempFile(
			`codestream-diff-${path.basename(marker.file)}`,
			currentEditor.getText()
		);

		const markerEditor = (await atom.workspace.createItemForURI(diffPath)) as TextEditor;

		markerEditor.setTextInBufferRange(
			Convert.lsRangeToAtomRange(response!.range),
			response.marker.code
		);

		atom.workspace
			.getCenter()
			.getActivePane()
			.splitRight({ items: [markerEditor], copyActiveItem: false });

		Container.editorManipulator.scrollIntoView(markerEditor, response.range.start.line, {
			center: true,
		});

		this._splitDiffService!.diffEditors(currentEditor, markerEditor, { muteNotifications: true });
	}
}
