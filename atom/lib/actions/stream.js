import { upsert } from "../local-cache";
import { normalize } from "./utils";
import {
	savePendingPost,
	resolvePendingPost,
	rejectPendingPost,
	savePostsForStream,
	savePost,
	savePosts
} from "./post";
import { saveMarkers } from "./marker";
import { saveMarkerLocations } from "./marker-location";
import { open as openRepo } from "../git/GitRepo";
import rootLogger from "../util/Logger";
rootLogger.setLevel('trace');

const logger = rootLogger.forClass("actions/stream");

const tempId = (() => {
	let count = 0;
	return () => String(count++);
})();

export const saveStream = attributes => (dispatch, getState, { db }) => {
	return upsert(db, "streams", attributes).then(stream => {
		dispatch({
			type: "ADD_STREAM",
			payload: stream
		});
	});
};

export const saveStreams = attributes => (dispatch, getState, { db }) => {
	return upsert(db, "streams", attributes).then(streams =>
		dispatch({
			type: "ADD_STREAMS",
			payload: streams
		})
	);
};

class MarkerLocationFinder {
	constructor(repo, session, http, context, streamId) {
		this._logger = logger.forObject("actions/stream/MarkerLocationFinder");
		this._repo = repo;
		this._session = session;
		this._http = http;
		this._context = context;
		this._streamId = streamId;
	}

	async findLocations(markerIds) {
		const me = this;
		const myLogger = me._logger;
		myLogger.trace('.findLocations <=', markerIds);

		const repo = me._repo;
		const currentCommit = await repo.getCurrentCommit();
		let commit = currentCommit;
		let maxClimb = 10;

		const currentLocations = {};
		const missingMarkerIds = {};
		for (const id of markerIds) {
			missingMarkerIds[id] = 1;
		}

		while (Object.keys(missingMarkerIds).length && commit && --maxClimb) {
			myLogger.debug('Getting locations for commit', commit.hash);
			const locations = await this._getMarkerLocations(commit.hash);
			let calculatedLocations = {};

			for (const markerId of Object.keys(locations)) {if (missingMarkerIds[markerId]) {
				calculatedLocations[markerId] = locations[markerId];
				delete missingMarkerIds[markerId];
					}
			}

			const calculatedLocationsCount = Object.keys(calculatedLocations).length;
			myLogger.debug('Commit', commit.hash, 'has location information for', calculatedLocationsCount, 'markers');
			if (calculatedLocationsCount && !commit.equals(currentCommit)) {
				const deltas = await repo.getDeltasBetweenCommits(commit, currentCommit);
					const edits = this._getEditsForCurrentFile(deltas);
					if (edits.length) {
						myLogger.debug('File has changed from', commit.hash, 'to', currentCommit.hash, '- recalculating locations');
						calculatedLocations = await this._calculateLocations(
							calculatedLocations, edits, commit.hash, currentCommit.hash);
				} else {
					myLogger.debug('No changes in current file file from', commit.hash, 'to', currentCommit.hash);
				}
			}
			Object.assign(currentLocations, calculatedLocations);

			commit = await commit.getParent();
		}

		return currentLocations;
	}

	async _calculateLocations(locations, edits, originalCommitHash, newCommitHash) {
		const result = await this._http.put(
			"/calculate-locations?",
			{
				teamId: this._context.currentTeamId,
				streamId: this._streamId,
				originalCommitHash: originalCommitHash,
				newCommitHash: newCommitHash,
				edits: edits,
				locations: locations
			},
			this._session.accessToken
		);
		return result.markerLocations.locations;
	}

	_getEditsForCurrentFile(deltas) {
		const me = this;
		const myLogger = me._logger;
		const currentFile = me._context.currentFile;

		let edits = deltas.filter(delta => delta.newFile === currentFile).map(delta => delta.edits);
		edits = [].concat.apply([], edits);

		myLogger.debug('Found', edits.length, 'edits for file', currentFile);
		return edits;
	}

	async _getMarkerLocations(commitHash) {
		const me = this;
		const myLogger = me._logger;
		myLogger.trace('._getMarkerLocations <=', commitHash)


			const { markerLocations } = await this._http.get(
				`/marker-locations?`+
				 `teamId=${this._context.currentTeamId}&`+
				 `streamId=${this._streamId}&`+
				 `commitHash=${commitHash}`,
				this._session.accessToken
			);
			constlocations =  markerLocations.locations || {};


		return locations;
	}
}

export const fetchStream = () => async (dispatch, getState, { http }) => {
	const { session, context, streams, repoAttributes } = getState();
	if (!streams.isFetching && context.currentFile !== "") {
		dispatch({ type: "FETCH_STREAM" });
		// create stream - right now the server doesn't complain if a stream already exists
		const streamData = await http.post(
			"/streams",
			{
				teamId: context.currentTeamId,
				type: "file",
				file: context.currentFile,
				repoId: context.currentRepoId
			},
			session.accessToken
		);
		dispatch({ type: "RECEIVE_STREAM" });
		const stream = normalize(streamData.stream);
		const { posts } = await http.get(
			`/posts?teamId=${context.currentTeamId}&streamId=${stream.id}`,
			session.accessToken
		);
		const { markers, markerLocations } = await http.get(
			`/markers?teamId=${context.currentTeamId}&streamId=${stream.id}&commitHash=${
				context.currentCommit
			}`,
			session.accessToken
		);

		const locations = markerLocations.locations || {};
		const markerLocationFinder = new MarkerLocationFinder(
			await openRepo(repoAttributes.workingDirectory),
			session,
			http,
			context,
			stream.id
		);

		logger.debug('Found', markers.length, 'markers');
		const missingMarkerIds = markers
			.filter(marker => !locations[marker._id])
			.map(marker => marker._id);
		logger.debug('Recalculating locations for', missingMarkerIds.length, 'missing markers');
		const calculatedLocations = markerLocationFinder.findLocations(missingMarkerIds);
		Object.assign(locations, calculatedLocations);

		await dispatch(saveStream(stream));
		await dispatch(saveMarkers(normalize(markers)));

		await dispatch(saveMarkerLocations(normalize(markerLocations)));
		dispatch(savePostsForStream(stream.id, normalize(posts)));
	}
};

export const markStreamRead = streamId => async (dispatch, getState, { http }) => {
	const { session, context, streams } = getState();
	if (context.currentFile !== "") {
		const markReadData = await http.put("/read/" + streamId, {}, session.accessToken);
		dispatch({ type: "CLEAR_UMI", payload: streamId });
		// console.log("READ THE STREAM", markReadData, session);

		// don't do this here. change the state of the UMIs and let the
		// server handle changing and updating the user object
		// if (false && this.props.currentUser) {
		// 	let lastReadsKey = "lastReads." + this.props.id;
		// 	delete this.props.currentUser[lastReadsKey];
		// }
	}
};

export const setStreamUMITreatment = (path, setting) => async (dispatch, getState) => {
	const { session, context } = getState();
	// FIXME -- we should save this info to the server rather than atom config
	let repo = atom.project.getRepositories()[0];
	let relativePath = repo.relativize(path);
	atom.config.set("CodeStream.showUnread-" + relativePath, setting);
	return;
};

export const incrementUMI = post => async (dispatch, getState, { http }) => {
	const { session, context, users, streams } = getState();
	const currentUser = users[session.userId];

	// don't increment UMIs for posts you wrote yourself
	if (post.creatorId === session.userId) return;

	// don't increment the UMI of the current stream, presumably because you
	// see the post coming in. FIXME -- if we are not scrolled to the bottom,
	// we should still increment the UMI
	if (
		streams.byFile[context.currentFile] &&
		streams.byFile[context.currentFile].id === post.streamId
	)
		return;

	var hasMention = post.text.match("@" + currentUser.username + "\\b");
	let type = hasMention ? "INCREMENT_MENTION" : "INCREMENT_UMI";
	dispatch({
		type: type,
		payload: post.streamId
	});
};

export const recalculateUMI = () => async (dispatch, getState, { http }) => {
	const { session, users, streams, posts } = getState();
	const currentUser = users[session.userId];

	// FIXME -- need all new posts as well

	console.log("RECALCULATING UMI: ");
	let mentionRegExp = new RegExp("@" + currentUser.username + "\\b");

	let lastReads = currentUser.lastReads;
	let nextState = { mentions: {}, unread: {} };
	let streamsById = {};
	Object.keys(streams.byFile).forEach(key => {
		streamsById[streams.byFile[key].id] = streams.byFile[key];
	});
	Object.keys(lastReads).forEach(key => {
		let lastRead = lastReads[key];
		let unread = 0;
		let mentions = 0;
		if (lastRead) {
			// find the stream for key
			// then calculate the unread Messages
			let stream = streamsById[key];
			let posts = _.sortBy(posts.byStream[key]);

			if (!posts) return;
			let postIds = posts.map(post => {
				return post.id;
			});
			let index = postIds.indexOf(lastRead);
			for (let i = index; i < posts.length; i++) {
				unread++;
				let post = posts[i];
				if (post && post.text && post.text.match(mentionRegExp)) {
					mentions++;
				}
			}
			if (unread) nextState.unread[key] = unread;
			if (mentions) nextState.mentions[key] = mentions;
		}
	});

	dispatch({
		type: "SET_UMI",
		payload: nextState
	});
};

export const createPost = (streamId, parentPostId, text, codeBlocks) => async (
	dispatch,
	getState,
	{ http }
) => {
	const { session, context } = getState();
	const pendingId = tempId();

	let post = {
		id: pendingId,
		teamId: context.currentTeamId,
		timestamp: new Date().getTime(),
		creatorId: session.userId,
		parentPostId: parentPostId,
		codeBlocks: codeBlocks,
		commitHashWhenPosted: context.currentCommit,
		streamId,
		text
	};

	dispatch(savePendingPost(post));

	try {
		const data = await http.post("/posts", post, session.accessToken);
		dispatch(
			resolvePendingPost(pendingId, {
				post: normalize(data.post),
				markers: normalize(data.markers),
				markerLocations: data.markerLocations
			})
		);
	} catch (error) {
		// TODO: different types of errors?
		dispatch(rejectPendingPost(streamId, pendingId, { ...post, error: true }));
	}
};
