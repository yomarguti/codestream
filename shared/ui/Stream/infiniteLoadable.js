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
	const batchCount = 100;

	const DataProvider = connect(
		mapStateToProps,
		{ fetchPosts }
	)(
		class Provider extends React.Component {
			state = { isFetching: false, isInitialized: false, posts: [], hasMore: true };

			componentDidMount() {
				this.initialize();
			}

			componentDidUpdate(prevProps, _prevState) {
				if (!this.state.isFetching && prevProps.streamId !== this.props.streamId) {
					return this.initialize();
				}
				if (!this.state.isFetching && !isEqual(prevProps.postIds, this.props.postIds)) {
					this.setState({ posts: this.props.posts });
				}
			}

			async initialize() {
				this.setState({ isInitialized: false });

				if (this.props.posts.length === 0) {
					const { streamId, teamId, fetchPosts } = this.props;
					const posts = await fetchPosts({ streamId, teamId, limit: batchCount });
					this.setState({
						isInitialized: true,
						posts: this.props.posts,
						hasMore: posts.length === batchCount
					});
				} else {
					this.setState({ isInitialized: true, posts: this.props.posts, hasMore: true });
				}
			}

			onSectionRendered = debounceToAnimationFrame(data => {
				this.lastRenderedRowsData = data;

				if (this.state.hasMore && data.startIndex === 0) {
					const { posts } = this.state;
					const earliestLocalSeqNum = safe(() => posts[0].seqNum);
					if (earliestLocalSeqNum && earliestLocalSeqNum > 1) {
						this.loadMore(earliestLocalSeqNum);
					} else {
						this.setState({ hasMore: false });
					}
				}
			});

			loadMore = async seqNum => {
				if (!this.state.isInitialized || this.state.isFetching) {
					return;
				}

				this.setState({ isFetching: true });
				const { fetchPosts, streamId, teamId } = this.props;

				const posts = await fetchPosts({
					streamId,
					teamId,
					limit: batchCount,
					beforeSeqNum: seqNum
				});
				this.setState({ hasMore: posts.length === batchCount });

				this.onScrollStop(() => {
					this.setState({ posts: this.props.posts, isFetching: false });
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
					try {
						this.onDidStopScrolling && this.onDidStopScrolling();
					} catch (e) {
						console.error(e);
					} finally {
						this.onDidStopScrolling = null;
					}
				}, 500);
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
							onScroll: this.onScroll,
							isFetchingMore: this.state.isFetching,
							scrollProps: this.state.scrollProps,
							hasMore: this.state.hasMore
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
