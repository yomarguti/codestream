import * as React from "react";
import { connect } from "react-redux";
import { isEqual } from "underscore";
import { getPostsForStream } from "../reducers/posts";
import { fetchPosts, fetchThread } from "./actions";
import { safe } from "../utils";

const mapStateToProps = (state, props) => {
	const { streamId, isThread, threadId } = props.childProps;
	let posts = getPostsForStream(state.posts, streamId);

	if (threadId) {
		posts = posts.filter(p => p.id === threadId || p.parentPostId === threadId);
	}

	return {
		isThread,
		posts,
		postIds: posts.map(p => p.id)
	};
};

export default Child => {
	const batchCount = 100;

	const DataProvider = connect(
		mapStateToProps,
		{ fetchPosts, fetchThread }
	)(
		class Provider extends React.Component {
			state = { isFetching: false, isInitialized: false, posts: [], hasMore: true };

			componentDidMount() {
				this.initialize();
			}

			componentDidUpdate(prevProps, _prevState) {
				if (this.props.isThread && prevProps.isThread) {
					if (this.props.childProps.threadId !== prevProps.childProps.threadId)
						return this.initialize();
				}
				if (
					!this.state.isFetching &&
					prevProps.childProps.streamId !== this.props.childProps.streamId
				) {
					return this.initialize();
				}
				if (!this.state.isFetching && !isEqual(prevProps.postIds, this.props.postIds)) {
					this.setState({ posts: this.props.posts });
				}
			}

			async initialize() {
				this.setState({ isInitialized: false });

				const { childProps, isThread, fetchPosts, fetchThread } = this.props;
				const { streamId, teamId, threadId } = childProps;

				if (isThread) {
					if (threadId && !this.props.posts.some(p => p.id === threadId)) {
						await fetchThread(streamId, threadId);
					}
					this.setState({
						isInitialized: true,
						posts: this.props.posts,
						hasMore: false
					});
				} else {
					if (this.props.posts.length === 0) {
						const { more } = await fetchPosts({ streamId, teamId, limit: batchCount });
						this.setState({
							isInitialized: true,
							posts: this.props.posts,
							hasMore: more
						});
					} else {
						this.setState({
							isInitialized: true,
							posts: this.props.posts,
							hasMore: true
						});
					}
				}
			}

			onDidScrollToTop = () => {
				if (!this.props.childProps.threadId && this.state.hasMore) {
					const { posts } = this.state;
					const earliestLocalSeqNum = safe(() => posts[0].seqNum);
					if (earliestLocalSeqNum && earliestLocalSeqNum > 1) {
						this.loadMore(earliestLocalSeqNum);
					} else {
						this.setState({ hasMore: false });
					}
				}
			};

			loadMore = async seqNum => {
				if (!this.state.isInitialized || this.state.isFetching) {
					return;
				}

				this.setState({ isFetching: true });
				const { fetchPosts, childProps } = this.props;
				const { streamId, teamId } = childProps;

				const { more } = await fetchPosts({
					streamId,
					teamId,
					limit: batchCount,
					beforeSeqNum: seqNum
				});

				this.onScrollStop(() => {
					this.setState({
						posts: this.props.posts,
						isFetching: false,
						hasMore: more
					});
				});
			};

			scrollTimeout = null;

			onScrollStop = fn => {
				if (!this.scrollTimeout) {
					fn();
				} else {
					this.onDidStopScrolling = fn;
				}
			};

			onScroll = () => {
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
							<div className="loader-ring">
								<div className="loader-ring__segment" />
								<div className="loader-ring__segment" />
								<div className="loader-ring__segment" />
								<div className="loader-ring__segment" />
							</div>
							<p>Loading posts...</p>
						</div>
					);

				return (
					<Child
						{...childProps}
						{...{
							ref: forwardedRef,
							posts: this.state.posts,
							onDidScrollToTop: this.onDidScrollToTop,
							register: this.register,
							onScroll: this.onScroll,
							isFetchingMore: this.state.isFetching,
							hasMore: this.state.hasMore
						}}
					/>
				);
			}
		}
	);

	return React.forwardRef((props, ref) => {
		return <DataProvider childProps={props} forwardedRef={ref} />;
	});
};
