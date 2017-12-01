import http from "../network-request";

export default store => {
	return {
		async fetchStream() {
			const { accessToken, currentFile, repos, repoMetadata } = store.getViewData();
			const { teamId, _id } = repos.find(repo => repo.url === repoMetadata.url);
			// create stream - right now the server doesn't complain if a stream already exists
			const { stream } = await http.post(
				"/streams",
				{ teamId, type: "file", file: currentFile, repoId: _id },
				accessToken
			);

			const streamId = stream._id;
			const { posts } = await http.get(`/posts?teamId=${teamId}&streamId=${streamId}`, accessToken);

			store.addStream(stream, posts);
		},

		async createPost(text) {
			const { accessToken, currentFile, repos, repoMetadata, streams } = store.getViewData();
			const { teamId } = repos.find(repo => repo.url === repoMetadata.url);
			const stream = streams.find(stream => stream.file === currentFile);
			const streamId = stream._id;

			const post = { _id: "temp1", teamId, streamId: stream._id, text };

			store.addPost(streamId, post);

			try {
				const data = await http.post("/posts", post, accessToken);
				store.updatePost(streamId, "temp1", data.post);
			} catch (error) {
				store.updatePost(streamId, "temp1", { ...post, error: true });
			}
		}
	};
};
