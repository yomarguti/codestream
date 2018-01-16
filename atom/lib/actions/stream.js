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
// rootLogger.setLevel('trace');

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
		this._locationsByCommitHash = {};
	}

	async find(markerId) {
		const me = this;
		const myLogger = me._logger;
		myLogger.trace(`.find <= ${markerId}`);

		const repo = me._repo;
		const currentCommit = await repo.getCurrentCommit();
		let commit = currentCommit;
		let maxClimb = 10;

		while (commit && --maxClimb) {
			myLogger.debug(`Checking locations for commit ${commit.hash}`);
			const locations = await this._getMarkerLocations(commit.hash);
			let location = locations[markerId];

			if (location) {
				myLogger.debug(`Commit ${commit.hash} has location information for marker ${markerId}`);
				if (!commit.equals(currentCommit)) {
					myLogger.debug(
						`Location is not up to date - getting deltas from ${commit.hash} to ${
							currentCommit.hash
						}`
					);

					const deltas = await repo.getDeltasBetweenCommits(commit, currentCommit);
					const edits = this._getEditsForCurrentFile(deltas);
					if (edits.length) {
						const calculatedLocations = await this._calculateLocations(
							locations,
							edits,
							commit.hash,
							currentCommit.hash
						);
						const currentLocations =
							this._locationsByCommitHash[currentCommit.hash] ||
							(this._locationsByCommitHash[currentCommit.hash] = {});
						Object.assign(currentLocations, calculatedLocations);

						myLogger.debug(`Location recalculated ${location} -> ${currentLocations[markerId]}`);

						location = currentLocations[markerId];
					}
				} else {
					myLogger.debug(`Location is up to date`);
				}

				return location;
			} else {
				myLogger.debug(`Location not found, checking parent commit`);
				commit = await commit.getParent();
			}
		}

		return null;
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

		myLogger.debug(`Found ${edits.length} edits for file ${currentFile}`);
		return edits;
	}

	async _getMarkerLocations(commitHash) {
		const me = this;
		const myLogger = me._logger;
		const cache = this._locationsByCommitHash;
		let locations = cache[commitHash];

		myLogger.debug(`Finding locations for commit ${commitHash}`);

		if (!locations) {
			myLogger.debug(`Locations not found - cache miss`);
			const { markerLocations } = await this._http.get(
				`/marker-locations?` +
					`teamId=${this._context.currentTeamId}&` +
					`streamId=${this._streamId}&` +
					`commitHash=${commitHash}`,
				this._session.accessToken
			);
			locations = cache[commitHash] = markerLocations.locations || {};
			myLogger.debug(`Got ${Object.keys(locations).length} locations from server`);
		} else {
			myLogger.debug(`Locations found - cache hit`);
		}

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

		logger.debug(`Found ${markers.length} markers`);

		for (const marker of markers) {
			const markerId = marker._id;
			if (!locations[markerId]) {
				logger.debug(`Recalculating location for marker ${markerId}`);
				locations[markerId] = await markerLocationFinder.find(markerId);
			} else {
				logger.debug(`Location for marker ${markerId} is up to date`);
			}
		}

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
