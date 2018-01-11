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

	constructor(repo, session, http, teamId, streamId) {
		this._repo = repo;
		this._session = session;
		this._http = http;
		this._teamId = teamId;
		this._streamId = streamId;
		this._locationsByCommitHash = {};
	}

	async find(markerId) {
		const repo = this._repo;
		const currentCommit = await repo.getCurrentCommit();
		let commit = currentCommit;
		let maxClimb = 10;

		while (commit && --maxClimb) {
			const locations = await this._getMarkerLocations(commit.hash);
			const location = locations[markerId];

			if (location) {
				if (!commit.equals(currentCommit)) {
					const deltas = repo.getDeltasBetweenCommits(commit, currentCommit);
					debugger;
				}

				return location;
			}

			commit = await commit.getParent();
		}

		return null;
	}

	async _getMarkerLocations(commitHash) {
		const cache = this._locationsByCommitHash;
		let locations = cache[commitHash];

		if (!locations) {
			const { markerLocations } = await this._http.get(
				`/marker-locations?`
				+ `teamId=${this._teamId}&`
				+ `streamId=${this._streamId}&`
				+ `commitHash=${commitHash}`,
				this._session.accessToken
			);
			locations = cache[commitHash] = markerLocations.locations;
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

		const locations = markerLocations.locations;
		const markerLocationFinder = new MarkerLocationFinder(
			await openRepo(repoAttributes.workingDirectory),
			session,
			http,
			context.currentTeamId,
			stream.id);

		for (const marker of markers) {
			const markerId = marker._id;
			if (!locations[markerId]) {
				debugger;
				locations[markerId] = await markerLocationFinder.find(markerId);
			}
		}

		await dispatch(saveStream(stream));
		await dispatch(saveMarkers(normalize(markers)));


		await dispatch(saveMarkerLocations(normalize(markerLocations)));
		dispatch(savePostsForStream(stream.id, normalize(posts)));
	}
};

// const _recalculateLocation = () = async {}

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
