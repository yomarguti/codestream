import { CSPost } from "@codestream/protocols/api";
import { action } from "../common";
import { PendingPost, Post, PostsActionsType } from "./types";
import { HostApi } from "@codestream/webview/webview-api";
import { GetPostsRequestType } from "@codestream/protocols/agent";

export const reset = () => action("RESET");

export const bootstrapPosts = (posts: Post[]) => action(PostsActionsType.Bootstrap, posts);

export const addPosts = (posts: Post[]) => action(PostsActionsType.Add, posts);

export const addPendingPost = (post: PendingPost) => action(PostsActionsType.AddPendingPost, post);

export const resolvePendingPost = (pendingId: string, post: CSPost) =>
	action(PostsActionsType.ResolvePendingPost, { pendingId, post });

export const failPendingPost = (pendingId: string) =>
	action(PostsActionsType.FailPendingPost, pendingId);

export const cancelPendingPost = (pendingId: string) =>
	action(PostsActionsType.CancelPendingPost, pendingId);

export const addPostsForStream = (streamId: string, posts: CSPost[]) =>
	action(PostsActionsType.AddForStream, { posts, streamId });

export const updatePost = (post: CSPost) => action(PostsActionsType.Update, post);

export const deletePost = (post: CSPost) => action(PostsActionsType.Delete, post);

export const getPosts = (
	streamId: string,
	postIds: string[],
	parentPostId?: string
) => async dispatch => {
	const { posts } = await HostApi.instance.send(GetPostsRequestType, {
		streamId,
		postIds,
		parentPostId
	});
	dispatch(addPosts(posts));
};
