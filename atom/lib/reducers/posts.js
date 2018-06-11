import _ from "underscore-plus";

// const initialState = {
// 	byStream: {},
// 	pending: []
// };

// If stream for a pending post is created, the pending post will be lost (not displayed)
// TODO: reconcile pending posts for a file with stream when the stream is created
export const getPostsForStream = ({ byStream, pending }, streamId = "") => {
	if (streamId === "") return [];
	const pendingForStream = pending.filter(it => {
		try {
			return it.streamId === streamId || it.stream.file === streamId;
		} catch (e) {
			return false;
		}
	});
	return [..._.sortBy(byStream[streamId], "seqNum"), ...pendingForStream];
};

export const getPostsForRepo = ({ byRepo, pending }, repoId) => {
	if (!repoId) return [];
	const posts = [..._.sortBy(byRepo[repoId], "createdAt"), ...pending];
	return posts.slice(posts.length - 100);
};

export const getPost = ({ byStream }, streamId, postId) => {
	return (byStream[streamId] || {})[postId];
};

export const getPostById = (posts, id) => {
	let post = null;
	Object.entries(posts.byStream).some(([_streamId, postsById]) => {
		const found = postsById[id];
		if (found) {
			post = found;
			return true;
		}
	});
	return post;
};
