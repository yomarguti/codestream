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
import { open as openRepo } from '../git/GitRepo';
import rootLogger from '../util/Logger';
rootLogger.setLevel('trace');

const logger = rootLogger.forClass('actions/stream');

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
		this._logger = logger.forObject('actions/stream/MarkerLocationFinder');
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
		logger.trace(`.find <= ${markerId}`);
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
					myLogger.debug(`Location is not up to date - getting deltas from ${commit.hash} to ${currentCommit.hash}`);

					const deltas = await repo.getDeltasBetweenCommits(commit, currentCommit);
					const edits = this._getEditsForCurrentFile(deltas);
					if (edits.length) {
						const calculatedLocations = await this._calculateLocations(
							locations, edits, commit.hash, currentCommit.hash);
						const currentLocations = this._locationsByCommitHash[currentCommit.hash]
							|| (this._locationsByCommitHash[currentCommit.hash] = {});
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
		const result = await this._http.put('/calculate-locations?', {
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

		let edits = deltas
			.filter(delta => delta.newFile === currentFile)
			.map(delta => delta.edits);
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
				`/marker-locations?`
				+ `teamId=${this._context.currentTeamId}&`
				+ `streamId=${this._streamId}&`
				+ `commitHash=${commitHash}`,
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
			stream.id);

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
