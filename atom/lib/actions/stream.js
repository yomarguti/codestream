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

export const fetchStream = () => async (dispatch, getState, { http }) => {
	const { session, context, streams } = getState();
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
	const { session, context, streams } = getState();
	// FIXME -- we should save this info to the server rather than atom config
	let repo = atom.project.getRepositories()[0];
	let relativePath = repo.relativize(path);
	let stream = streams.byFile[relativePath];
	atom.config.set("CodeStream.showUnread-" + stream.id, setting);
	return;
};

export const incrementUMI = post => async (dispatch, getState, { http }) => {
	const { session, users } = getState();
	const currentUser = users[session.userId];

	var re = new RegExp("@" + currentUser.username + "\\b");
	var hasMention = post.text.match("@" + currentUser.username + "\\b");
	let type = hasMention ? "INCREMENT_MENTION" : "INCREMENT_UMI";
	dispatch({
		type: type,
		payload: post.streamId
	});
};

export const recalculateUMI = () => async (dispatch, getState, { http }) => {
	const { session, users, streams } = getState();
	const currentUser = users[session.userId];
	// FIXME -- need all new posts as well
	dispatch({
		type: "RECALCULATE_UMI",
		payload: {
			lastReads: currentUser.lastReads,
			streams: streams
		}
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
