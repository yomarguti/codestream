import { CSPost } from "@codestream/protocols/api";
import { Index } from "../common";

export interface PendingPost
	extends Pick<CSPost, "id" | "text" | "streamId" | "parentPostId" | "creatorId" | "createdAt"> {
	pending: true;
	codemark: {};
	error?: boolean;
}

export type Post = PendingPost | CSPost;

export function isPending(post: Post): post is PendingPost {
	return (post as PendingPost).pending;
}

export interface State {
	byStream: {
		[streamId: string]: Index<CSPost>;
	};
	pending: PendingPost[];
}

export enum PostsActionsType {
	Bootstrap = "BOOTSTRAP_POSTS",
	Add = "ADD_POSTS",
	AddPendingPost = "ADD_PENDING_POST",
	AddForStream = "ADD_POSTS_FOR_STREAM",
	Update = "UPDATE_POST",
	ResolvePendingPost = "RESOLVE_PENDING_POST",
	FailPendingPost = "PENDING_POST_FAILED",
	CancelPendingPost = "CANCEL_PENDING_POST",
	Delete = "DELETE_POST"
}
