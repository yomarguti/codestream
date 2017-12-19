import reduce from "../../lib/reducers/posts";

const post1 = { streamId: "1", id: "1-1", text: "text1" };
const post2 = { streamId: "1", id: "1-2", text: "text2" };
const post3 = { streamId: "2", id: "2-1", text: "text3" };

describe("reducer for posts", () => {
	describe("on BOOTSTRAP_POSTS and ADD_POSTS", () => {
		it("saves an array of posts by stream", () => {
			const postsFromDb = [post1, post2, post3];

			const expected = {
				byStream: {
					"1": { [post1.id]: post1, [post2.id]: post2 },
					"2": { [post3.id]: post3 }
				}
			};
			const bootstrapResult = reduce(undefined, { type: "BOOTSTRAP_POSTS", payload: postsFromDb });
			const addResult = reduce(undefined, { type: "ADD_POSTS", payload: postsFromDb });

			expect(bootstrapResult).toEqual(expected);
			expect(addResult).toEqual(expected);
		});
	});

	it("adds posts to the stream", () => {
		const state = {
			byStream: {
				"1": { [post1.id]: post1, [post2.id]: post2 },
				"2": { [post3.id]: post3 }
			}
		};

		const newPost = { streamId: "2", id: "2-2", text: "text4" };

		const expected = {
			byStream: {
				"1": { [post1.id]: post1, [post2.id]: post2 },
				"2": { [post3.id]: post3, [newPost.id]: newPost }
			}
		};

		const result = reduce(state, { type: "ADD_PENDING_POST", payload: newPost });

		expect(result).toEqual(expected);
	});

	describe("adding posts in bulk", () => {
		it("updates the existing ones", () => {
			const state = {
				byStream: {
					"1": { [post1.id]: post1, [post2.id]: post2 },
					"2": { [post3.id]: post3 }
				}
			};

			const replacementForPost2 = { streamId: "1", id: "1-2", text: "changing post2 text" };
			const newPost = { streamId: "1", id: "1-3", text: "text4" };
			const newPosts = [replacementForPost2, newPost];

			const expected = {
				byStream: {
					"1": { [post1.id]: post1, [post2.id]: replacementForPost2, [newPost.id]: newPost },
					"2": { [post3.id]: post3 }
				}
			};

			const action = {
				type: "ADD_POSTS_FOR_STREAM",
				payload: { streamId: "1", posts: newPosts }
			};

			expect(reduce(state, action)).toEqual(expected);
		});
	});

	it("resolves pending posts by replacing it", () => {
		const state = {
			byStream: {
				"1": { [post1.id]: post1, [post2.id]: post2 },
				"2": { [post3.id]: post3, pendingId: { streamId: "2", id: "pendingId" } }
			}
		};

		const resolvedPost = { streamId: "2", id: "2-2", text: "text4" };

		const expected = {
			byStream: {
				"1": { [post1.id]: post1, [post2.id]: post2 },
				"2": { [post3.id]: post3, [resolvedPost.id]: resolvedPost }
			}
		};

		const action = {
			type: "RESOLVE_PENDING_POST",
			payload: { pendingId: "pendingId", post: resolvedPost }
		};

		const result = reduce(state, action);
		console.log(result);
		expect(result).toEqual(expected);
	});
});
