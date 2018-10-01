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
			const { firstUnreadPostSeqNum, posts } = this.props;

			const streamChanged = prevProps.streamId !== this.props.streamId;
			if (streamChanged) {
				this.cache.clearAll();
				safe(() => this.list.recomputeRowHeights());
				this.scrollToBottom();
			}
			if (!streamChanged && prevPosts.length !== posts.length) {
				if (prevPosts.length === 0 || !this.scrolledOffBottom) {
					// FIXME only scroll to the first unread message
					this.scrollToBottom();
				}
			}

			const unreadsChanged = prevProps.firstUnreadPostSeqNum !== firstUnreadPostSeqNum;
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
					post => post.seqNum === this.props.firstUnreadPostSeqNum
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

		// TODO: maybe this should be more like `onNeedsResize`
		onUpdatePost = index => {
			const { startIndex, stopIndex } = this.lastRenderedRowsData;
			if (index >= startIndex && index <= stopIndex) {
				this.recomputeVisibleRowHeights(startIndex, stopIndex);
				if (!this.scrolledOffBottom) requestAnimationFrame(this.scrollToBottom); // TODO: be more selective about which things change
			}
		};

		focusOnRow = index => {
			const { startIndex, stopIndex } = this.lastRenderedRowsData;
			if (index <= startIndex || index >= stopIndex) this.list.scrollToRow(index);
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

		recomputeVisibleRowHeights = debounceToAnimationFrame((start, stop) => {
			for (let i = start; i < stop; i++) {
				this.cache.clear(i);
				safe(() => this.list.recomputeRowHeights(i));
			}
		});

		onRowsRendered = data => {
			this.lastRenderedRowsData = data;

			const {
				firstUnreadPostSeqNum,
				hasFocus,
				onDidChangeVisiblePosts,
				onSectionRendered,
				posts
			} = this.props;

			onSectionRendered(data);
			const startIndex = this.listIndexToPostIndex(data.startIndex);
			const stopIndex = this.listIndexToPostIndex(data.stopIndex);

			if (!isNumber(firstUnreadPostSeqNum))
				return onDidChangeVisiblePosts({ unreadsAbove, unreadsBelow });

			let unreadsAbove = false;
			let unreadsBelow = false;

			const visibleSeqNums = posts.slice(startIndex, stopIndex + 1).map(p => p.seqNum);

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
				if (indexOfFirstUnread > -1) {
					// if first unread is visible and there are unseen unreads below, end here
					unreadsBelow = posts.slice(startIndex + indexOfFirstUnread).some(post => {
						if (!this.seenPosts.has(post.seqNum)) {
							return true;
						}
					});
					return onDidChangeVisiblePosts({ unreadsAbove, unreadsBelow });
				} else {
					// first unread is not in sight so look for unseen unreads below
					if (visibleSeqNums[visibleSeqNums.length - 1] < posts[posts.length - 1].seqNum) {
						for (let i = stopIndex + 2; i < posts.length; i++) {
							const post = posts[i];
							if (!this.seenPosts.has(post.seqNum)) {
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
					if (!this.seenPosts.has(post.seqNum)) {
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
				postAction,
				postWithNewMessageIndicator,
				posts,
				renderIntro
			} = this.props;
			let unread = false;

			let listProps = {};
			// scrollToIndex is easier than `this.list.scrollToPosition` because we don't have to recalc the scrollTop
			if (this.state.shouldScrollTo) {
				listProps.scrollToIndex = this.state.shouldScrollTo;
			}

			console.debug("PostList.render", { props: this.props, state: this.state, listProps });
			return (
				<AutoSizer>
					{({ height, width }) => {
						this.maxHeight = height;
						const listStyle = {};
						let introHeight = 0;
						if (renderIntro) {
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
									if (data.index === 0 && renderIntro) {
										return (
											<CellMeasurer
												cache={this.cache}
												key={data.key}
												columnIndex={0}
												rowIndex={data.index}
												parent={data.parent}
											>
												<div style={{ ...data.style }}>{renderIntro()}</div>
											</CellMeasurer>
										);
									}
									const index = this.listIndexToPostIndex(data.index);
									const post = posts[index];

									// if (data.isScrolling)
									// 	return <div style={{ ...data.style, backgroundColor: "pink", width: 30 }} />;

									const parentPost = post.parentPostId
										? posts.find(p => p.id === post.parentPostId)
										: null;
									const newMessageIndicator =
										typeof postWithNewMessageIndicator !== "undefined" &&
										post.seqNum === postWithNewMessageIndicator + 1;
									unread = unread || newMessageIndicator;

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
													replyingTo={parentPost}
													newMessageIndicator={newMessageIndicator}
													unread={post.seqNum >= this.props.firstUnreadPostSeqNum}
													editing={isActive && post.id === editingPostId}
													action={postAction}
													index={index}
													focusOnRow={this.focusOnRow}
													onNeedsResize={this.onUpdatePost}
													showDetails={this.props.showDetails}
													streamId={this.props.streamId}
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
