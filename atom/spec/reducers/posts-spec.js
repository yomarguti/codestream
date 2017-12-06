import reduce from "../../lib/reducers/posts";

const post1 = { streamId: "1", id: "1-1", text: "text1" };
const post2 = { streamId: "1", id: "1-2", text: "text2" };
const post3 = { streamId: "2", id: "2-1", text: "text3" };

describe("reducer for posts", () => {
	it("bootstraps data", () => {
		const postsFromDb = [post1, post2, post3];

		const expected = {
			byStream: {
				"1": { [post1.id]: post1, [post2.id]: post2 },
				"2": { [post3.id]: post3 }
			},
			sortPerStream: {
				"1": [post1.id, post2.id],
				"2": [post3.id]
			}
		};
		const result = reduce(undefined, { type: "BOOTSTRAP_POSTS", payload: postsFromDb });

		expect(result).toEqual(expected);
	});

	it("adds posts to the stream and its sorted collection", () => {
		const state = {
			byStream: {
				"1": { [post1.id]: post1, [post2.id]: post2 },
				"2": { [post3.id]: post3 }
			},
			sortPerStream: {
				"1": [post1.id, post2.id],
				"2": [post3.id]
			}
		};

		const newPost = { streamId: "2", id: "2-2", text: "text4" };

		const expected = {
			byStream: {
				"1": { [post1.id]: post1, [post2.id]: post2 },
				"2": { [post3.id]: post3, [newPost.id]: newPost }
			},
			sortPerStream: {
				"1": [post1.id, post2.id],
				"2": [post3.id, newPost.id]
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
				},
				sortPerStream: {
					"1": [post1.id, post2.id],
					"2": [post3.id]
				}
			};

			const replacementForPost2 = { streamId: "1", id: "1-2", text: "changing post2 text" };
			const newPost = { streamId: "1", id: "1-3", text: "text4" };
			const newPosts = [replacementForPost2, newPost];

			const expected = {
				byStream: {
					"1": { [post1.id]: post1, [post2.id]: replacementForPost2, [newPost.id]: newPost },
					"2": { [post3.id]: post3 }
				},
				sortPerStream: {
					"1": [post1.id, post2.id, newPost.id],
					"2": [post3.id]
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
			},
			sortPerStream: {
				"1": [post1.id, post2.id],
				"2": [post3.id, "pendingId"]
			}
		};

		const resolvedPost = { streamId: "2", id: "2-2", text: "text4" };

		const expected = {
			byStream: {
				"1": { [post1.id]: post1, [post2.id]: post2 },
				"2": { [post3.id]: post3, [resolvedPost.id]: resolvedPost }
			},
			sortPerStream: {
				"1": [post1.id, post2.id],
				"2": [post3.id, resolvedPost.id]
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
