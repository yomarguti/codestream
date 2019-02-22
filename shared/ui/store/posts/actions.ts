import { CSPost } from "../../shared/api.protocol";
import { action } from "../common";
import { PendingPost, Post, PostsActionsType } from "./types";

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
