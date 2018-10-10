import * as React from "react";
import { AutoSizer, CellMeasurer, CellMeasurerCache, List } from "react-virtualized";
import { isNumber } from "underscore";
import DateSeparator from "./DateSeparator";
import Post from "./Post";
import infiniteLoadable from "./infiniteLoadable";
import { debounceToAnimationFrame, safe } from "../utils";

const noop = () => {};
export default infiniteLoadable(
	class PostList extends React.Component {
		static defaultProps = {
			onDidChangeVisiblePosts: noop
		};
		list = null;
		cache = new CellMeasurerCache({
			defaultHeight: 60, // TODO: still play around with this to find a better estimate maybe?
			fixedWidth: true
		});
		seenPosts = new Set();
		scrolledOffBottom = false;

		constructor(props) {
			super(props);
			this.state = {
				shouldScrollTo: false
			};
		}

		async componentDidMount() {
			this.scrollToBottom();
		}

		componentDidUpdate(prevProps, _prevState) {
			const prevPosts = prevProps.posts;
			const { lastReadSeqNum, posts } = this.props;

			const streamChanged = prevProps.streamId !== this.props.streamId;
			const threadChanged =
				prevProps.isThread && this.props.isThread && prevProps.threadId !== this.props.threadId;
			if (streamChanged || threadChanged) {
				this.cache.clearAll();
				safe(() => this.list.recomputeRowHeights());
			}
			if (streamChanged) this.scrollToBottom();
			if (!streamChanged && prevPosts.length !== posts.length) {
				if (prevProps.isFetchingMore && !this.props.isFetchingMore) {
					this.cache.clearAll();
					this.list.recomputeRowHeights();
					this.maintainScroll(this.props.posts.length - prevPosts.length);
				}
				if (prevPosts.length === 0 || !this.scrolledOffBottom) {
					// FIXME only scroll to the first unread message
					this.scrollToBottom();
				}
			}

			if (prevProps.hasMore && !this.props.hasMore) {
				this.cache.clearAll();
				this.list.recomputeRowHeights();
			}

			const unreadsChanged = prevProps.lastReadSeqNum !== lastReadSeqNum;
			if (unreadsChanged) this.seenPosts.clear();
			if (
				unreadsChanged ||
				(!prevProps.hasFocus && this.props.hasFocus) ||
				this.scrolledOffBottom // is this still necessary
			) {
				if (this.lastRenderedRowsData) this.onRowsRendered(this.lastRenderedRowsData);
			}
		}

		resize = () => {
			requestAnimationFrame(() => {
				if (!this.scrolledOffBottom) {
					this.scrollToBottom();
				}
			});
		};

		maintainScroll = scrollTo => {
			this.setState(
				{
					scrollProps: {
						scrollToIndex: scrollTo,
						scrollToAlignment: "start"
					}
				},
				() => this.setState({ scrollProps: null })
			);
		};
		scrollToBottom = () => {
			requestAnimationFrame(() => {
				this.setState(
					state => {
						if (!state.shouldScrollTo)
							return {
								shouldScrollTo: this.props.posts.length
							};
						return null;
					},
					() => {
						requestAnimationFrame(() => this.setState({ shouldScrollTo: null }));
					}
				);
			});
		};

		scrollToUnread = location => {
			if (location === "above") {
				const unreadIndex = this.props.posts.findIndex(
					(post, i, posts) => (i > 0 ? posts[i - 1].seqNum === this.props.lastReadSeqNum : false)
				);
				if (unreadIndex > -1) this.list.scrollToRow(this.listIndexToPostIndex(unreadIndex));
				// else this.scrollToBottom(); // TODO: get the newPostIndicator when switching streams
			} else this.scrollToBottom();
		};

		scrollTo = index => this.list.scrollToRow(this.listIndexToPostIndex(index));

		getUsersMostRecentPost = () => {
			const { editingPostId, posts } = this.props;
			const { overscanStartIndex, stopIndex } = this.lastRenderedRowsData;
			const beginSearchIndex = this.listIndexToPostIndex(editingPostId ? stopIndex : posts.length);

			const editingPostIndex = posts.findIndex(post => post.id === editingPostId);
			for (
				let index = beginSearchIndex;
				index >= this.listIndexToPostIndex(overscanStartIndex);
				index--
			) {
				const post = posts[index];
				if (editingPostIndex > -1 && index >= editingPostIndex) continue;
				if (post.creatorId === this.props.currentUserId) {
					return { post, index };
				}
			}
			return {};
		};

		setRef = element => {
			this.props.register(this, element, this.cache);
			this.list = element;
		};

		onNeedsResize = index => {
			this.recomputeHeight(index);
			// if bottom-most post, scroll it all into view
			if (index === this.props.posts.length) this.scrollToBottom();
		};

		recomputeHeight = index => {
			this.cache.clear(index);
			this.list.recomputeRowHeights(index);
		};

		focusOnRow = index => {
			const { startIndex, stopIndex } = this.lastRenderedRowsData;
			if (index <= startIndex || index >= stopIndex) this.list.scrollToRow(index);
		};

		onRowDidResize = index => {
			this.recomputeHeight(index);
		};

		onScroll = data => {
			const { clientHeight, scrollHeight, scrollTop } = data;
			this.props.onScroll(data);
			let scrolledOffBottom;
			const lastRowHeight = this.cache.getHeight(this.props.posts.length);
			const scrollOffset = scrollHeight - clientHeight - scrollTop;

			if (scrollOffset <= lastRowHeight) {
				scrolledOffBottom = false;
			} else {
				scrolledOffBottom = true;
			}

			this.scrolledOffBottom = scrolledOffBottom;
			return null;
		};

		// TODO: still necessary?
		recomputeVisibleRowHeights = debounceToAnimationFrame((start, stop) => {
			this.cache.clearAll();
			this.list.recomputeRowHeights();
			// for (let i = start; i < stop; i++) {
			// 	this.cache.clear(i);
			// 	safe(() => this.list.recomputeRowHeights(i));
			// }
		});

		onRowsRendered = data => {
			this.lastRenderedRowsData = data;

			const {
				lastReadSeqNum,
				hasFocus,
				onDidChangeVisiblePosts,
				onSectionRendered,
				posts
			} = this.props;

			onSectionRendered(data);
			const startIndex = data.startIndex === 0 ? 1 : this.listIndexToPostIndex(data.startIndex);
			const stopIndex = this.listIndexToPostIndex(data.stopIndex);

			if (!isNumber(lastReadSeqNum)) {
				return onDidChangeVisiblePosts({ unreadsAbove, unreadsBelow });
			}

			const firstUnreadPost = posts.find((post, i) => {
				return safe(() => Number(posts[i - 1].seqNum)) === lastReadSeqNum;
			});
			if (!firstUnreadPost) return;

			const firstUnreadPostSeqNum = Number(firstUnreadPost.seqNum);

			let unreadsAbove = false;
			let unreadsBelow = false;

			const visibleSeqNums = posts.slice(startIndex, stopIndex + 1).map(p => Number(p.seqNum));

			// consider visible posts seen
			if (hasFocus) {
				visibleSeqNums.forEach(seqNum => {
					if (seqNum >= firstUnreadPostSeqNum) {
						this.seenPosts.add(seqNum);
					}
				});
			}

			// check whether there are unreads below the last visible post
			if (this.scrolledOffBottom) {
				let indexOfFirstUnread = visibleSeqNums.indexOf(firstUnreadPostSeqNum);
				if (indexOfFirstUnread > -1 && indexOfFirstUnread > posts.length) {
					// if first unread is visible and there are unseen unreads below, end here
					unreadsBelow = posts.slice(startIndex + indexOfFirstUnread).some(post => {
						if (!this.seenPosts.has(post.seqNum)) {
							return true;
						}
					});
					return onDidChangeVisiblePosts({ unreadsAbove, unreadsBelow });
				} else {
					// first unread is not in sight so look for unseen unreads below
					if (visibleSeqNums[visibleSeqNums.length - 1] < Number(posts[posts.length - 1].seqNum)) {
						for (let i = stopIndex; i < posts.length; i++) {
							const post = posts[i];
							if (!this.seenPosts.has(Number(post.seqNum))) {
								unreadsBelow = true;
								break;
							}
						}
					}
				}
			}

			// if what is visible is below the first unread, check for unseen unreads above
			if (visibleSeqNums[0] > firstUnreadPostSeqNum) {
				for (let i = startIndex - 1; i >= 0; i--) {
					const post = posts[i];
					if (!this.seenPosts.has(Number(post.seqNum))) {
						unreadsAbove = true;
						break;
					}
				}
			}

			onDidChangeVisiblePosts({ unreadsAbove, unreadsBelow });
		};

		// the first item is reserverd for an intro/loading indicator
		listIndexToPostIndex = index => {
			return index - 1;
		};

		render() {
			const {
				editingPostId,
				id,
				isActive,
				newMessagesAfterSeqNum,
				postAction,
				posts,
				renderIntro,
				isFetchingMore,
				hasMore
			} = this.props;

			let listProps = {};
			// scrollToIndex is easier than `this.list.scrollToPosition` because we don't have to recalc the scrollTop
			if (this.state.shouldScrollTo) {
				listProps.scrollToIndex = this.state.shouldScrollTo;
			}
			if (this.state.scrollProps) listProps = this.state.scrollProps;

			console.debug("PostList.render", { props: this.props, state: this.state, listProps });

			return (
				<AutoSizer>
					{({ height, width }) => {
						this.maxHeight = height;
						const listStyle = {};
						let introHeight = 0;
						if (isFetchingMore || hasMore) introHeight = this.cache.defaultHeight;
						else if (renderIntro) {
							const heightForPosts = posts.length * this.cache.defaultHeight;
							if (heightForPosts > 0 && heightForPosts < height / 2) {
								introHeight = height - heightForPosts / 2;
								listStyle.paddingTop = height - heightForPosts - introHeight;
							} else introHeight = 300;
						}
						return (
							<List
								style={listStyle}
								id={id}
								ref={this.setRef}
								height={height}
								width={width}
								rowHeight={({ index }) => {
									return index === 0 ? introHeight : this.cache.rowHeight({ index });
								}}
								rowCount={posts.length + 1}
								overscanRowCount={20}
								{...listProps}
								onScroll={this.onScroll}
								noRowsRenderer={renderIntro}
								onRowsRendered={this.onRowsRendered}
								rowRenderer={data => {
									if (data.index === 0) {
										return (
											<CellMeasurer
												cache={this.cache}
												key={data.key}
												columnIndex={0}
												rowIndex={data.index}
												parent={data.parent}
											>
												<div style={{ ...data.style, textAlign: "center" }}>
													{hasMore || isFetchingMore ? (
														<div>
															<p>Loading more posts...</p>
														</div>
													) : (
														safe(renderIntro)
													)}
												</div>
											</CellMeasurer>
										);
									}
									const index = this.listIndexToPostIndex(data.index);
									const post = posts[index];

									// if (data.isScrolling)
									// 	return <div style={{ ...data.style, backgroundColor: "pink", width: 30 }} />;

									// if the parent post isn't yet in local collection because it's further back, use the id
									const parentPost =
										post.parentPostId && post.ParentPostId !== post.id
											? posts.find(p => p.id === post.parentPostId) || post.parentPostId
											: null;

									const firstUnreadPost = this.props.posts.find((p, i, array) => {
										return safe(() => Number(array[i - 1].seqNum) === newMessagesAfterSeqNum);
									});

									const element = (
										<CellMeasurer
											cache={this.cache}
											key={data.key}
											columnIndex={0}
											rowIndex={data.index}
											parent={data.parent}
										>
											<div style={data.style}>
												<DateSeparator
													timestamp1={safe(() => posts[index - 1].createdAt)}
													timestamp2={post.createdAt}
												/>
												<Post
													id={post.id}
													usernames={this.props.usernamesRegexp}
													currentUserId={this.props.currentUserId}
													currentUserName={this.props.currentUserName}
													replyingTo={!this.props.isThread && parentPost}
													newMessageIndicator={
														firstUnreadPost &&
														Number(post.seqNum) === Number(firstUnreadPost.seqNum)
													}
													editing={isActive && post.id === editingPostId}
													action={postAction}
													index={data.index}
													focusOnRow={this.focusOnRow}
													onRowDidResize={this.onRowDidResize}
													onNeedsResize={this.onNeedsResize}
													showDetails={this.props.isThread}
													streamId={this.props.streamId}
													didTriggerThread={
														this.props.isThread && post.id === this.props.threadTrigger
													}
												/>
											</div>
										</CellMeasurer>
									);

									return element;
								}}
							/>
						);
					}}
				</AutoSizer>
			);
		}
	}
);
