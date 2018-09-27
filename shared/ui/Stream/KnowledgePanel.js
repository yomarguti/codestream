import React, { Component } from "react";
import { connect } from "react-redux";
import createClassString from "classnames";
import _ from "underscore";
import { createStream, setCurrentStream, setUserPreference } from "./actions";
import {
	getChannelStreamsForTeam,
	getDirectMessageStreamsForTeam,
	getServiceStreamsForTeam,
	getPostsForStream,
	getStreamForTeam,
	getStreamForId,
	getDMName
} from "../reducers/streams";
import { toMapBy } from "../utils";
import Icon from "./Icon";
import Tooltip from "./Tooltip";
import Post from "./Post";

export class SimpleKnowledgePanel extends Component {
	constructor(props) {
		super(props);

		this.state = {
			openPosts: {},
			statusPosts: {}
		};
	}

	render() {
		const { knowledgeType } = this.props;

		const inactive = this.props.activePanel !== "knowledge";
		const shrink = this.props.activePanel === "main";

		const knowledgePanelClass = createClassString({
			panel: true,
			"knowledge-panel": true,
			shrink,
			"off-right": inactive && !shrink
		});
		let knowledgeLabel = "";
		switch (knowledgeType) {
			case "comment":
				knowledgeLabel = "Code Comments";
				break;
			case "question":
				knowledgeLabel = "Questions & Answers";
				break;
			case "issue":
				knowledgeLabel = "Issues";
				break;
			case "trap":
				knowledgeLabel = "Code Traps";
				break;
			case "snippet":
				knowledgeLabel = "Snippets";
				break;
		}

		return (
			<div className={knowledgePanelClass}>
				<div className="panel-header">
					{this.state.searchBarOpen && (
						<div className="search-bar">
							<input
								name="q"
								className="native-key-bindings input-text control"
								type="text"
								ref={ref => (this._searchInput = ref)}
								onChange={e => this.setState({ q: e.target.value })}
							/>
							<span className="align-right-button" onClick={this.handleClickSearch}>
								<Tooltip title="Cancel">
									<Icon name="x" className="cancel-icon" />
								</Tooltip>
							</span>
						</div>
					)}
					<span className="align-left-button" onClick={() => this.props.setActivePanel("channels")}>
						<Icon name="chevron-left" className="show-channels-icon" />
					</span>
					<span className="panel-title">{knowledgeLabel}</span>
					<span className="align-right-button-second" onClick={this.handleClickAddKnowledge}>
						<Tooltip title="New Thing">
							<Icon name="plus" className="plus-icon" />
						</Tooltip>
					</span>
					<span className="align-right-button" onClick={this.handleClickSearch}>
						<Tooltip title="Search">
							<Icon name="search" className="search-icon" />
						</Tooltip>
					</span>
				</div>
				<div className="shadow-overlay">
					<div className="shadow-container">
						<div className="shadow shadow-top" />
						<div className="shadow shadow-bottom" />
					</div>
					<div className="channel-panel vscroll" onClick={this.handleClickPost}>
						<div class="shadow-cover-top" />
						{this.props.posts.map(post => {
							if (post.deactivated) return null;
							if (this.state.q && !(post.text || "").includes(this.state.q)) return null;
							return (
								<div key={post.id}>
									<Post
										post={post}
										q={this.state.q}
										showStatus={true}
										status={
											post.id in this.state.statusPosts
												? this.state.statusPosts[post.id]
												: post.text.match(/w/)
										}
										extraClass={this.state.openPosts[post.id] ? "expanded" : "collapsed"}
										context="knowledge"
										headshotSize={18}
										usernames={this.props.usernames}
										currentUserId={this.props.currentUserId}
										currentUserName={this.props.currentUserName}
										currentCommit={this.props.currentCommit}
										action={this.props.postAction}
									/>
								</div>
							);
						})}
						<div class="shadow-cover-bottom" />
					</div>
				</div>
			</div>
		);
	}

	handleClickAddKnowledge = e => {
		e.stopPropagation();
		this.props.setActivePanel("main");
	};

	handleClickSearch = e => {
		e.stopPropagation();
		if (!this.state.searchBarOpen)
			setTimeout(() => {
				this._searchInput.focus();
			}, 20);
		this.setState({ searchBarOpen: !this.state.searchBarOpen });
	};

	handleClickPost = event => {
		var postDiv = event.target.closest(".post");
		if (!postDiv) return;

		console.log("CL: ", event.target.classList);
		// if they clicked a link, follow the link rather than selecting the post
		if (event && event.target && event.target.tagName === "A") return false;

		// console.log(event.target.id);
		if (event.target.id === "cancel-button") {
			// if the user clicked on the cancel changes button,
			// presumably because she is editing a post, abort
			this.setState({ editingPostId: null });
			return;
		} else if (event.target.id === "save-button") {
			// if the user clicked on the save changes button,
			// save the new post text
			return this.editPost(postDiv.id);
		} else if (postDiv.classList.contains("editing")) {
			// otherwise, if we aren't currently editing the
			// post, go to the thread for that post, but if
			// we are editing, then do nothing.
			return;
		} else if (postDiv.classList.contains("system-post")) {
			// otherwise, if we aren't currently editing the
			// post, go to the thread for that post, but if
			// we are editing, then do nothing.
			return;
		} else if (event.target.closest(".status-button")) {
			// if the user clicked on the checkmark; toggle status
			return this.toggleStatus(postDiv.id);
		} else if (window.getSelection().toString().length > 0) {
			// in this case the user has selected a string
			// by dragging
			return;
		}
		this.selectPost(postDiv.id);
	};

	toggleStatus = id => {
		this.setState({
			statusPosts: { ...this.state.statusPosts, [id]: !this.state.statusPosts[id] }
		});
	};

	selectPost = id => {
		this.setState({ openPosts: { ...this.state.openPosts, [id]: !this.state.openPosts[id] } });
	};

	handleClickCreateKnowledge = e => {
		e.stopPropagation();
		this.props.setActivePanel("main");
		setTimeout(() => {
			this.props.runSlashCommand("multi-compose");
		}, 500);
		return;
	};

	handleClickSelectItem = event => {
		event.preventDefault();
		var liDiv = event.target.closest("li");
		if (!liDiv) return; // FIXME throw error
		if (liDiv.id) {
			this.props.setActivePanel("main");
			this.props.setCurrentStream(liDiv.id);
		} else if (liDiv.getAttribute("teammate")) {
			this.props.createStream({ type: "direct", memberIds: [liDiv.getAttribute("teammate")] });
		} else {
			console.log("Unknown LI in handleClickSelectStream: ", event);
		}
	};
}

const mapStateToProps = ({ context, streams, users, teams, umis, posts, session }) => {
	const teamMembers = teams[context.currentTeamId].memberIds.map(id => users[id]).filter(Boolean);
	// .filter(user => user && user.isRegistered);

	const channelStreams = _.sortBy(
		getChannelStreamsForTeam(streams, context.currentTeamId, session.userId) || [],
		stream => (stream.name || "").toLowerCase()
	);

	const user = users[session.userId];
	const mutedStreams = (user && user.preferences && user.preferences.mutedStreams) || {};

	const directMessageStreams = (
		getDirectMessageStreamsForTeam(streams, context.currentTeamId) || []
	).map(stream => ({
		...stream,
		name: getDMName(stream, toMapBy("id", teamMembers), session.userId)
	}));

	const serviceStreams = _.sortBy(
		getServiceStreamsForTeam(streams, context.currentTeamId, session.userId, users) || [],
		stream => -stream.createdAt
	);

	// get a list of the users i have 1:1 streams with
	const oneOnOnePeople = directMessageStreams
		.map(stream => {
			const notMe = _.without(stream.memberIds || [], session.userId);
			if (notMe.length === 1) return notMe[0];

			// this is my stream with myself, if it exists
			if (stream.memberIds.length === 1 && stream.memberIds[0] === session.userId) {
				stream.isMeStream = true;
				return session.userId;
			}
			return;
		})
		.filter(Boolean);

	const teamStream = getStreamForTeam(streams, context.currentTeamId) || {};
	const postStream =
		getStreamForId(streams, context.currentTeamId, context.currentStreamId) || teamStream;
	const streamPosts = getPostsForStream(posts, postStream.id);

	return {
		umis,
		users,
		posts,
		channelStreams,
		directMessageStreams,
		serviceStreams,
		mutedStreams,
		teammates: teamMembers,
		oneOnOnePeople,
		team: teams[context.currentTeamId],
		posts: streamPosts.map(post => {
			let user = users[post.creatorId];
			if (!user) {
				if (post.creatorId === "codestream") {
					user = {
						username: "CodeStream",
						email: "",
						fullName: ""
					};
				} else {
					console.warn(
						`Redux store doesn't have a user with id ${post.creatorId} for post with id ${post.id}`
					);
					user = {
						username: "Unknown user",
						email: "",
						fullName: ""
					};
				}
			}
			const { username, email, fullName = "", color } = user;
			return {
				...post,
				author: {
					username,
					email,
					color,
					fullName
				}
			};
		})
	};
};

export default connect(
	mapStateToProps,
	{
		createStream,
		setUserPreference,
		setCurrentStream
	}
)(SimpleKnowledgePanel);
