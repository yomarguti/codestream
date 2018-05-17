// @flow
import { CompositeDisposable, Directory, TextEditor } from "atom";
import type { Resource, Store } from "../types/codestream";
import { open as openRepo } from "../git/GitRepo";
import * as http from "../network-request";
import { getStreamForRepoAndFile } from "../reducers/streams";
import MarkerLocationFinder from "../git/MarkerLocationFinder";
import { areEqualLocations } from "../util/Marker";
import { saveMarkers } from "../actions/marker";
import { saveMarkerLocations } from "../actions/marker-location";
import { normalize } from "../actions/utils";

export default class MarkerLocationTracker implements Resource {
	subscriptions = new CompositeDisposable();
	observedEditors: Map<number, TextEditor> = new Map();
	store: Store;
	repoDirectory: Directory;

	constructor(store: Store) {
		this.store = store;
		this.repoDirectory = new Directory(store.getState().repoAttributes.workingDirectory);

		this.subscriptions.add(
			atom.workspace.observeActiveTextEditor((editor: ?TextEditor) => {
				if (editor && !this.observedEditors.has(editor.id)) {
					const id = editor.id;
					this.observedEditors.set(id, editor);
					this.calculateLocations(editor);
					this.subscriptions.add(
						editor.onDidDestroy(() => this.observedEditors.delete(id)),
						editor.getBuffer().onDidReload(() => this.calculateLocations(editor)),
						editor.onDidStopChanging(() => this.calculateLocations(editor))
					);
				}
			})
		);
	}

	async calculateLocations(editor: TextEditor) {
		const { context, repoAttributes, session, streams } = this.store.getState();

		const gitRepo = await openRepo(repoAttributes.workingDirectory);
		const teamId = context.currentTeamId;
		const commitHash = context.currentCommit;

		const filePath = await gitRepo.relativize(editor.getPath());
		if (!filePath) return;

		const fileStream = getStreamForRepoAndFile(streams, context.currentRepoId, filePath);
		if (fileStream) {
			// TODO we shouldn't have to ask the server every single time
			// this should come from the store
			const { markers, markerLocations } = await http.get(
				`/markers?teamId=${teamId}&streamId=${fileStream.id}&commitHash=${commitHash}`,
				session.accessToken
			);
			const locations = (markerLocations || {}).locations || {};
			const finder = new MarkerLocationFinder({
				filePath,
				gitRepo,
				http,
				teamId,
				streamId: fileStream.id,
				accessToken: session.accessToken
			});

			const missingMarkers = markers.filter(marker => !locations[marker._id]);
			if (missingMarkers.length) {
				console.debug("Recalculating locations for", missingMarkers.length, "missing markers");
				const calculatedLocations = await finder.findLocationsForCurrentCommit(missingMarkers);
				Object.assign(locations, calculatedLocations);
			}

			const dirty = {};
			const text = editor.getText();
			if (text !== undefined) {
				const bufferLocations = await finder.findLocationsForUncommittedChanges(locations, text);
				for (const markerId of Object.keys(bufferLocations)) {
					const bufferLocation = bufferLocations[markerId];
					const lastCommitLocation = locations[markerId];
					if (!areEqualLocations(bufferLocation, lastCommitLocation)) {
						dirty[markerId] = bufferLocation;
					}
				}

				const streamLocations = this.store.getState().markerLocations.byStream[fileStream.id] || {};
				const uncommittedLocations = streamLocations.uncommitted || [];
				for (const uncommitted of uncommittedLocations) {
					const markerId = uncommitted.marker._id;
					const bufferLocations = await finder.findUpdatedLocations(
						{ [markerId]: uncommitted.location },
						filePath,
						uncommitted.bufferText,
						text
					);
					dirty[markerId] = bufferLocations[markerId];
				}
			}
			this.store.dispatch(saveMarkers(normalize(markers)));
			this.store.dispatch(
				saveMarkerLocations({ streamId: fileStream.id, teamId, commitHash, locations, dirty })
			);
		}
	}

	destroy() {
		this.subscriptions.dispose();
		this.observedEditors.clear();
	}
}
