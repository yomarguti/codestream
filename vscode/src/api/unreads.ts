"use strict";
import { Logger } from "../logger";
import { Arrays } from "../system/array";
import { CSPost, CSStream, StreamType } from "./api";
import { CodeStreamSession, UnreadsChangedEvent } from "./session";

export class UnreadCounter {
	private lastReads: { [streamId: string]: number } = Object.create(null);
	private mentions: { [streamId: string]: number } = Object.create(null);
	private unread: { [streamId: string]: number } = Object.create(null);

	constructor(
		public readonly session: CodeStreamSession,
		private readonly _currentUserId: string
	) {}

	clear(streamId: string) {
		delete this.unread[streamId];
		delete this.mentions[streamId];
	}

	private _computePromise: Promise<void> | undefined;
	async compute(
		lastReads: { [streamId: string]: number } | undefined,
		notifier: (e: UnreadsChangedEvent) => void
	) {
		if (this._computePromise !== undefined) {
			await this._computePromise;
		}

		this._computePromise = this.computeCore(lastReads, notifier);
		return this._computePromise;
	}

	async get() {
		if (this._computePromise !== undefined) {
			await this._computePromise;
		}
		return this.values();
	}

	async update(posts: CSPost[], notifier: (e: UnreadsChangedEvent) => void) {
		// Don't increment unreads for deleted, edited (if edited it isn't the first time its been seen), has replies (same as edited), or was posted by the current user
		posts = posts.filter(
			p =>
				!p.deactivated &&
				!p.hasBeenEdited &&
				!p.hasReplies &&
				p.creatorId !== this._currentUserId &&
				Object.keys(p.reactions).length === 0
		);
		if (posts.length === 0) return;

		if (this._computePromise !== undefined) {
			await this._computePromise;
		}

		Logger.log(`Unreads.update:`, `Updating unreads for ${posts.length} posts...`);

		const grouped = Arrays.groupBy(posts, p => p.streamId);

		// const streams = await Promise.all(
		// 	Object.keys(grouped).map(async streamId => this.session.api.getStream(streamId))
		// );

		for (const [streamId, posts] of Object.entries(grouped)) {
			const stream = await this.session.api.getStream(streamId);
			if (stream == null) continue;

			this.mentions[streamId] = this.mentions[streamId] || 0;
			this.unread[streamId] = this.unread[streamId] || 0;

			Logger.log(
				`Unreads.update(${streamId}):`,
				`Before: mentions=${this.mentions[streamId]}, unreads=${this.unread[streamId]}`
			);

			this.computeForPosts(posts, this._currentUserId, stream);

			if (this.lastReads[streamId] === undefined) {
				this.lastReads[streamId] = posts[0].seqNum - 1;
			}

			Logger.log(
				`Unreads.update(${streamId}):`,
				`After: mentions=${this.mentions[streamId]}, unreads=${this.unread[streamId]}`
			);
		}

		const values = this.values();
		Logger.log(`Unreads.update:`, `Completed; values=${JSON.stringify(values)}`);

		notifier(new UnreadsChangedEvent(this.session, values));
	}

	private values() {
		return {
			unread: this.unread,
			mentions: this.mentions,
			lastReads: this.lastReads
		};
	}

	private async computeCore(
		lastReads: { [streamId: string]: number } | undefined,
		notifier: (e: UnreadsChangedEvent) => void
	) {
		if (lastReads === undefined) {
			lastReads = Object.create(null) as { [streamId: string]: number };
		}

		// Reset the counters
		this.unread = Object.create(null);
		this.mentions = Object.create(null);

		Logger.log(`Unreads.compute:`, "Computing...");

		const unreadStreams = await this.session.api.getUnreadStreams();
		if (unreadStreams.length !== 0) {
			const entries = Object.entries(lastReads);

			await Promise.all(
				entries.map(async ([streamId, lastReadSeqNum]) => {
					const stream = unreadStreams.find(stream => stream.id === streamId);
					if (stream == null) return;

					let latestPost;
					let unreadPosts;
					try {
						latestPost = await this.session.api.getLatestPost(streamId);
						unreadPosts = await this.session.api.getPostsInRange(
							streamId,
							lastReadSeqNum + 1,
							latestPost.seqNum
						);
						unreadPosts = unreadPosts.filter(
							p => !p.deactivated && p.creatorId !== this._currentUserId
						);
					} catch (ex) {
						// likely an access error because user is no longer in this channel
						debugger;
						Logger.error(ex);
						return;
					}

					if (unreadPosts != null && unreadPosts.length !== 0) {
						this.mentions[streamId] = this.mentions[streamId] || 0;
						this.unread[streamId] = this.unread[streamId] || 0;
						this.computeForPosts(unreadPosts, this._currentUserId, stream);

						Logger.log(
							`Unreads.compute(${streamId}):`,
							`mentions=${this.mentions[streamId]}, unreads=${this.unread[streamId]}`
						);
					}
				})
			);
		}

		// Updates our cache with the lastReads from the current user
		this.lastReads = lastReads;
		this._computePromise = undefined;

		const values = this.values();
		Logger.log(`Unreads.compute:`, `Completed; values=${JSON.stringify(values)}`);

		notifier(new UnreadsChangedEvent(this.session, values));
	}

	private computeForPosts(posts: CSPost[], userId: string, stream?: CSStream) {
		for (const post of posts) {
			if (
				(stream && stream.type) === StreamType.Direct ||
				(post.mentionedUserIds || []).includes(userId)
			) {
				this.mentions[post.streamId]++;
			}
			this.unread[post.streamId]++;
		}
	}
}
