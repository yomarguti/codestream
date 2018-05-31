// @flow
import { TextEditor } from "atom";
import Raven from "raven-js";
import { open as openRepo } from "./git/GitRepo";
import * as http from "./network-request";
import MarkerLocationFinder from "./git/MarkerLocationFinder";
import db, { upsert } from "./local-cache";
// import { saveUncommittedLocations } from "./actions/marker-location";
import { normalize } from "./actions/utils";
import type { Store } from "./types";

export default class CodeStreamApi {
	store: Store;

	constructor(store: Store) {
		this.store = store;
	}

	async createPost(
		id: string,
		streamId: string,
		parentPostId: ?string,
		text: string,
		codeBlocks: any[],
		mentions: string[],
		extra: any
	) {
		const { session, context, repoAttributes } = this.store.getState();

		// const gitRepo = await openRepo(repoAttributes.workingDirectory);
		// const editor: TextEditor = atom.workspace.getActiveTextEditor();
		// let hasUncommittedLocation = false;
		// if (editor) {
		// 	const isTrackedFile = await gitRepo.isTracked(editor.getPath());
		// 	const uncommittedLocations = [];
		// 	if (isTrackedFile) {
		// 		for (let i = 0; i < codeBlocks.length; i++) {
		// 			const codeBlock = codeBlocks[i];
		// 			const backtrackedLocations = await backtrackCodeBlockLocations(
		// 				codeBlocks,
		// 				editor.getText(),
		// 				codeBlock.streamId,
		// 				this.store.getState(),
		// 				http
		// 			);
		// 			const lastCommitLocation = backtrackedLocations[i];
		// 			const meta = lastCommitLocation[4] || {};
		// 			if (meta.startWasDeleted || meta.endWasDeleted) {
		// 				hasUncommittedLocation = true;
		// 			}
		// 			uncommittedLocations.push(codeBlock.location);
		// 			codeBlock.location = lastCommitLocation;
		// 		}
		// 	} else {
		// 		for (const codeBlock of codeBlocks) {
		// 			hasUncommittedLocation = true;
		// 			uncommittedLocations.push(codeBlock.location);
		// 			delete codeBlock.location;
		// 		}
		// 	}
		// }

		const post = {
			id,
			streamId,
			teamId: context.currentTeamId,
			timestamp: new Date().getTime(),
			creatorId: session.userId,
			parentPostId: parentPostId,
			codeBlocks: codeBlocks,
			commitHashWhenPosted: context.currentCommit,
			mentionedUserIds: mentions && mentions.length ? mentions : null,
			text
		};

		try {
			const data = await http.post("/posts", post, session.accessToken);

			// if (hasUncommittedLocation) {
			// 	// this.store.dispatch(
			// 	// 	saveUncommittedLocations({
			// 	// 		...data,
			// 	// 		filePath,
			// 	// 		bufferText,
			// 	// 		uncommittedLocations
			// 	// 	})
			// 	// );
			// }
			// let streams = data.streams || [];
			// if (data.stream) data.streams.push(data.stream);
			// if (streams.length > 0) dispatch(saveStreams(normalize(streams)));
			// dispatch(resolvePendingPost(pendingId, normalize(data.post)));
			const savedPost = normalize(data.post);
			upsert(db, "posts", savedPost);
			return savedPost;
		} catch (error) {
			if (http.isApiRequestError(error)) {
				Raven.captureMessage(error.data.message, {
					logger: "actions/post",
					extra: { error: error.data }
				});
			}
			// TODO: different types of errors?
			throw error;
		}
	}
}

const backtrackCodeBlockLocations = async (codeBlocks, bufferText, streamId, state, http) => {
	const { context, repoAttributes, session } = state;
	const gitRepo = await openRepo(repoAttributes.workingDirectory);
	const locations = codeBlocks.map(codeBlock => codeBlock.location);
	const locationFinder = new MarkerLocationFinder({
		filePath: context.currentFile,
		gitRepo,
		http,
		accessToken: session.accessToken,
		teamId: context.currentTeamId,
		streamId
	});

	const backtrackedLocations = await locationFinder.backtrackLocationsAtCurrentCommit(
		locations,
		bufferText
	);
	return backtrackedLocations;
};
