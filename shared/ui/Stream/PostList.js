import * as React from "react";
import { debounce } from "underscore";
import DateSeparator from "./DateSeparator";
import Post from "./Post";
import Debug from "./Debug";
import infiniteLoadable from "./infiniteLoadable";
import { rAFThrottle, safe } from "../utils";

const noop = () => {};
export default infiniteLoadable(
	class PostList extends React.Component {
		static defaultProps = {
			onDidChangeVisiblePosts: noop
		};
		list = React.createRef();
		showUnreadBanner = true;
		scrolledOffBottom = false;
		state = {};

		async componentDidMount() {
			this.scrollToBottom();
			this.markAsRead();
		}

		getSnapshotBeforeUpdate(prevProps, _prevState) {
			if (prevProps.isFetchingMore && !this.props.isFetchingMore) {
				const $list = this.list.current;
				return $list.scrollHeight - $list.scrollTop;
			}
			return null;
		}

		componentDidUpdate(prevProps, _prevState, snapshot) {
			if (snapshot) this.list.current.scrollTop = this.list.current.scrollHeight - snapshot;

			const prevPosts = prevProps.posts;
			const { posts } = this.props;

			const streamChanged = this.props.streamId && prevProps.streamId !== this.props.streamId;
			const wasToggled =
				prevProps.isActive !== this.props.isActive || prevProps.hasFocus !== this.props.hasFocus;
			if (streamChanged) {
				this.scrollToBottom();
				this.resetUnreadBanner();
			}
			if (prevProps.isActive && !this.props.isActive) {
				this.showUnreadBanner = false;
				this.findFirstUnread(this.list.current);
			}
			if (streamChanged || wasToggled) {
				this.markAsRead();
			}
			if (!streamChanged && prevPosts.length !== posts.length) {
				if (!this.scrolledOffBottom) {
					this.markAsRead();
					// TODO: only scroll to the first unread message
					this.scrollToBottom();
					this.resetUnreadBanner();
				}
			}

			if (
				!streamChanged &&
				prevProps.newMessagesAfterSeqNum !== this.props.newMessagesAfterSeqNum
			) {
				this.resetUnreadBanner();
			}
		}

		componentWillUnmount() {
			this.handleScroll.cancel();
			this.findFirstUnread.cancel();
		}

		markAsRead = () => {
			if (this.props.isThread) return;

			const { hasFocus, isActive, posts, streamId } = this.props;

			const lastPost = posts.length > 0 && posts[posts.length - 1];
			if (hasFocus && isActive && lastPost) {
				if (lastPost.streamId === streamId) this.props.markRead(lastPost.id);
			}
		};

		resize = () => {
			requestAnimationFrame(() => {
				if (!this.scrolledOffBottom) {
					this.scrollToBottom();
				}
			});
		};

		scrollToBottom = () => {
			requestAnimationFrame(() => {
				if (this.list.current) {
					const { clientHeight, scrollHeight } = this.list.current;
					this.list.current.scrollTop = scrollHeight - clientHeight + 10000;
				}
			});
		};

		scrollToUnread = () => {
			const $firstUnreadPost = this.list.current
				.getElementsByClassName("post new-separator")
				.item(0);
			$firstUnreadPost && $firstUnreadPost.scrollIntoView({ behavior: "smooth" });
		};

		getUsersMostRecentPost = () => {
			const { editingPostId, posts } = this.props;
			const editingPostIndex = editingPostId && posts.findIndex(post => post.id === editingPostId);
			const beginSearchIndex = editingPostIndex || posts.length - 1;
			for (let index = beginSearchIndex; index >= 0; index--) {
				const post = posts[index];
				if (editingPostIndex && index >= editingPostIndex) continue;
				if (post.creatorId === this.props.currentUserId) {
					return post;
				}
			}
		};

		scrollTo = id => {
			const { posts } = this.props;
			if (id === posts[posts.length - 1].id) {
				this.scrollToBottom();
			} else {
				this.list.current
					.getElementsByClassName("post")
					.namedItem(id)
					.scrollIntoView({ behavior: "smooth" });
			}
		};

		handleScroll = rAFThrottle(target => {
			const { clientHeight, scrollTop } = target;
			if (scrollTop < 60) this.props.onDidScrollToTop();

			const $posts = target.getElementsByClassName("post");
			const lastPostPosition = $posts[$posts.length - 1].getBoundingClientRect().y;

			if (lastPostPosition >= clientHeight) {
				this.scrolledOffBottom = true;
			} else {
				this.scrolledOffBottom = false;
			}
		});

		onScroll = event => {
			if (!this.props.isThread) {
				this.props.onScroll();
				this.handleScroll(event.target);
				this.findFirstUnread(event.target);
			}
		};

		findFirstUnread = rAFThrottle($list => {
			const { newMessagesAfterSeqNum, onDidChangeVisiblePosts } = this.props;

			let unreadsAbove = false;
			let unreadsBelow = false;

			if (!$list || !this.showUnreadBanner || !newMessagesAfterSeqNum) {
				return onDidChangeVisiblePosts({ unreadsAbove, unreadsBelow });
			}

			let $firstUnreadPost = $list.getElementsByClassName("post new-separator").item(0);
			if (!$firstUnreadPost) return onDidChangeVisiblePosts({ unreadsAbove, unreadsBelow });
			const postDimensions = $firstUnreadPost.getBoundingClientRect();

			if (postDimensions.top < $list.getBoundingClientRect().top) {
				unreadsAbove = true;
			} else if (
				this.scrolledOffBottom &&
				postDimensions.top > $list.getBoundingClientRect().bottom
			) {
				unreadsBelow = true;
			}
			onDidChangeVisiblePosts({ unreadsBelow, unreadsAbove });
			if (!(unreadsAbove || unreadsBelow)) this.showUnreadBanner = false;
		});

		resetUnreadBanner = debounce(() => {
			const { posts, currentUserId } = this.props;
			if (posts.length === 0) return;
			if (posts[posts.length - 1].creatorId !== currentUserId) {
				this.showUnreadBanner = true;
				if (!this.props.isThread) this.findFirstUnread(this.list.current);
			}
		}, 1000);

		render() {
			const {
				editingPostId,
				isActive,
				newMessagesAfterSeqNum,
				postAction,
				posts,
				renderIntro,
				isFetchingMore,
				hasMore
			} = this.props;

			// console.debug("PostList.render", { props: this.props, state: this.state });

			return (
				<div className="postslist" ref={this.list} onScroll={this.onScroll}>
					{hasMore || isFetchingMore ? (
						<div style={{ textAlign: "center" }}>
							<p>Loading more posts...</p>
						</div>
					) : (
						safe(renderIntro)
					)}
					{this.props.posts.map((post, index) => {
						// if the parent post isn't yet in local collection because it's further back, use the id
						const parentPost =
							post.parentPostId && post.ParentPostId !== post.id
								? posts.find(p => p.id === post.parentPostId) || post.parentPostId
								: null;

						const hasNewMessageLine = safe(() => {
							if (!newMessagesAfterSeqNum) return false;

							const postIsAfterLastRead =
								Number(this.props.posts[index - 1].seqNum) === newMessagesAfterSeqNum;
							if (postIsAfterLastRead && post.creatorId !== this.props.currentUserId) {
								return true;
							}
						});

						return (
							<React.Fragment key={post.id}>
								<DateSeparator
									timestamp1={safe(() => posts[index - 1].createdAt)}
									timestamp2={post.createdAt}
								/>
								<Debug object={post}>
									<Post
										id={post.id}
										usernames={this.props.usernamesRegexp}
										currentUserId={this.props.currentUserId}
										currentUserName={this.props.currentUserName}
										replyingTo={!this.props.isThread && parentPost}
										newMessageIndicator={hasNewMessageLine}
										editing={isActive && post.id === editingPostId}
										action={postAction}
										showDetails={this.props.isThread}
										streamId={this.props.streamId}
										didTriggerThread={this.props.isThread && post.id === this.props.threadTrigger}
									/>
								</Debug>
							</React.Fragment>
						);
					})}
				</div>
			);
		}
	}
);
