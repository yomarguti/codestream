import * as React from "react";
import { connect } from "react-redux";
import { isEqual } from "underscore";
import { getPostsForStream } from "../reducers/posts";
import { fetchPosts } from "./actions";
import { safe, debounceToAnimationFrame } from "../utils";

const mapStateToProps = (state, props) => {
	let posts = getPostsForStream(state.posts, props.streamId);
	//
	// if (props.threadId) {
	// 	posts = posts.filter(p => p.id === props.threadId || p.parentPostId === props.threadId);
	// 	console.debug("PostList.mapStateToProps", { props, posts });
	// }
	return {
		posts,
		postIds: posts.map(p => p.id),
		childProps: props
	};
};

export default Child => {
	const initializePostCount = 150;
	const batchCount = 100;

	const DataProvider = connect(
		mapStateToProps,
		{ fetchPosts }
	)(
		class Provider extends React.Component {
			isFetching = false;
			hasMore = true;
			state = { isInitialized: false, posts: [] };

			componentDidMount() {
				this.initialize();
			}

			componentDidUpdate(prevProps, _prevState) {
				if (!this.isFetching && prevProps.streamId !== this.props.streamId) {
					return this.initialize();
				}
				if (!this.isFetching && !isEqual(prevProps.postIds, this.props.postIds)) {
					this.setState({ posts: this.props.posts });
				}
			}

			async initialize() {
				this.hasMore = true;
				this.setState({ isInitialized: false });

				if (this.props.posts.length === 0) {
					this.isFetching = true;
					const { streamId, teamId, fetchPosts } = this.props;
					const posts = await fetchPosts({ streamId, teamId, limit: initializePostCount });
					if (posts.length < initializePostCount) this.hasMore = false;
					this.setState(
						{ isInitialized: true, posts: this.props.posts },
						() => (this.isFetching = false)
					);
				} else {
					this.setState({ isInitialized: true, posts: this.props.posts });
				}
			}

			onSectionRendered = debounceToAnimationFrame(data => {
				this.lastRenderedRowsData = data;

				if (this.hasMore && data.startIndex < batchCount) {
					const { posts } = this.state;
					const earliestLocalSeqNum = safe(() => posts[0].seqNum);
					if (earliestLocalSeqNum && earliestLocalSeqNum > 1) {
						this.loadMore(earliestLocalSeqNum);
					}
				}
			});

			loadMore = async seqNum => {
				const title = "FETCH + SCROLL";
				console.group(title);
				if (!this.state.isInitialized || this.isFetching) {
					console.debug("already fetching");
					console.groupEnd(title);
					return;
				}

				this.isFetching = true;
				const { fetchPosts, streamId, teamId } = this.props;

				console.warn("FETCHING POSTS");
				const posts = await fetchPosts({
					streamId,
					teamId,
					limit: batchCount,
					beforeSeqNum: seqNum
				});
				if (posts.length < batchCount) this.hasMore = false;
				console.warn("GOT POSTS");

				this.onScrollStop(() => {
					const newPostsRange = posts.length;
					// const previousScrollTop = this.lastScrollData.scrollTop;
					const lastFirstPostIndex = this.lastRenderedRowsData.startIndex;
					console.warn("Render new posts");
					this.setState({ posts: this.props.posts }, () => {
						// const additionalHeight = newPostsRange * this.cache.defaultHeight;
						const scrollTo = lastFirstPostIndex + newPostsRange;
						// const newScrollPos = this.list.Grid.getTotalRowsHeight() * scrollRatio;
						console.warn("maintain user scroll position");
						console.groupEnd(title);
						// this.list.scrollToPosition(previousScrollTop + additionalHeight);
						this.cache.clearAll();
						this.postList.recomputeVisibleRowHeights(
							this.lastRenderedRowsData.startIndex,
							this.lastRenderedRowsData.stopIndex
						);
						this.list.scrollToRow(scrollTo);
						this.isFetching = false;
					});
				});
			};

			register = (postList, list, cache) => {
				this.postList = postList;
				this.list = list;
				this.cache = cache;
			};

			scrollTimeout = null;

			onScrollStop = fn => {
				if (!this.scrollTimeout) {
					fn();
				} else {
					this.onDidStopScrolling = fn;
				}
			};

			// debounce scroll events to determine when it ends
			onScroll = data => {
				this.lastScrollData = data;
				if (this.scrollTimeout) {
					clearTimeout(this.scrollTimeout);
				}
				this.scrollTimeout = setTimeout(() => {
					this.scrollTimeout = null;
					safe(() => {
						this.onDidStopScrolling();
						this.onDidStopScrolling = null;
					});
				}, 50);
			};

			render() {
				const { forwardedRef, childProps } = this.props;
				if (!this.state.isInitialized)
					return (
						<div className="loading-page">
							<span className="loading loading-spinner-large inline-block" />
							<p>Loading posts...</p>
						</div>
					);

				return (
					<Child
						{...childProps}
						{...{
							ref: forwardedRef,
							posts: this.state.posts,
							onSectionRendered: this.onSectionRendered,
							register: this.register,
							onScroll: this.onScroll
						}}
					/>
				);
			}
		}
	);

	return React.forwardRef((props, ref) => {
		return <DataProvider {...props} forwardedRef={ref} />;
	});
};
