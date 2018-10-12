import React, { Component } from "react";
import { connect } from "react-redux";
import createClassString from "classnames";
import _ from "underscore";
import { createStream, setCurrentStream, setUserPreference, showCode } from "./actions";
import { getAllPostsOfType } from "../reducers/streams";
import Icon from "./Icon";
import Tooltip from "./Tooltip";
import Post from "./Post";

export class SimpleKnowledgePanel extends Component {
	constructor(props) {
		super(props);

		this.state = {
			openPost: null,
			expanded: {
				inThisFile: true,
				recent: true,
				mine: true,
				open: true,
				closed: true,
				unanswered: true
			}
		};

		this.typeLabels = {
			comment: "Code Comments",
			question: "Questions & Answers",
			issue: "Issues",
			trap: "Code Traps",
			snippet: "Snippets"
		};
		this.sectionLabel = {
			inThisFile: "In This File",
			mine: "Open and Assigned To Me",
			open: "Open",
			recent: "Recent",
			closed: "Closed",
			unanswered: "Unanswered"
		};
		this.sectionsByType = {
			comment: ["inThisFile", "recent"],
			question: ["inThisFile", "unanswered", "recent"],
			issue: ["inThisFile", "mine", "open", "recent", "closed"],
			trap: ["inThisFile", "recent"]
		};
		this.sectionsFilterOrder = {
			comment: ["inThisFile", "recent"],
			question: ["inThisFile", "unanswered", "recent"],
			issue: ["closed", "inThisFile", "mine", "open", "recent"],
			trap: ["inThisFile", "recent"]
		};
	}

	toggleSection = (e, section) => {
		e.stopPropagation();
		this.setState({
			expanded: { ...this.state.expanded, [section]: !this.state.expanded[section] }
		});
	};

	renderPosts = posts => {
		const { knowledgeType } = this.props;
		if (posts.length === 0)
			return <div className="no-matches">No {knowledgeType}s in file foo/bar/baz.js</div>;
		else {
			return posts.map(post => {
				const collapsed = this.state.openPost !== post.id;
				return (
					<div key={post.id}>
						<Post
							id={post.id}
							streamId={post.streamId}
							q={this.state.q}
							showStatus={post.type === "issue"}
							showAssigneeHeadshots={true}
							teammates={this.props.teammates}
							collapsed={collapsed}
							showFileAfterTitle={collapsed}
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
			});
		}
	};

	renderSection = (section, posts) => {
		const { knowledgeType } = this.props;

		if (posts.length === 0) return null;

		return (
			<div
				className={createClassString("section", "has-children", {
					expanded: this.state.expanded[section]
				})}
			>
				<div className="header" onClick={e => this.toggleSection(e, section)}>
					<Icon name="triangle-right" className="triangle-right" />
					<span className="clickable">{this.sectionLabel[section]}</span>
				</div>
				<ul>{this.renderPosts(posts)}</ul>
			</div>
		);
	};

	render() {
		const { knowledgeType, posts, currentUserId } = this.props;

		if (!knowledgeType) return null;

		const inactive = this.props.activePanel !== "knowledge";
		const shrink = this.props.activePanel === "main" || this.props.activePanel === "thread";

		const knowledgePanelClass = createClassString({
			panel: true,
			"knowledge-panel": true,
			shrink,
			"off-right": inactive && !shrink
		});

		const knowledgeLabel = this.typeLabels[knowledgeType];
		const sections = this.sectionsByType[knowledgeType];

		let displayPosts = {};
		let assignedPosts = {};
		let sectionFilters = this.sectionsFilterOrder[knowledgeType] || [];

		const assignPost = (post, section) => {
			if (!displayPosts[section]) displayPosts[section] = [];
			displayPosts[section].push(post);
			assignedPosts[post.id] = true;
		};

		posts.forEach(post => {
			const postType = post.type || "comment";
			if (post.deactivated) return null;
			if (postType !== knowledgeType) return null;
			if (postType === "comment" && (!post.codeBlocks || !post.codeBlocks.length)) return null;
			sectionFilters.forEach(section => {
				if (assignedPosts[post.id]) return;
				// if (!this.state.expanded[section]) return;
				if (this.state.q && !post.text.includes(this.state.q) && !post.title.includes(this.state.q))
					return;
				switch (section) {
					case "inThisFile":
						if (Math.random() < 0) assignPost(post, "inThisFile");
						break;
					case "mine":
						if (
							post.status === "open" ||
							(!post.status && _.contains(post.assignees || [], currentUserId))
						)
							assignPost(post, "mine");
						break;
					case "open":
						if (post.status === "open" || !post.status) assignPost(post, "open");
						break;
					case "unanswered":
						if (!post.hasReplies) assignPost(post, "unanswered");
						break;
					case "recent":
						assignPost(post, "recent");
						break;
					case "closed":
						if (post.status === "closed") assignPost(post, "closed");
						break;
				}
			});
		});

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
					<span
						className="align-left-button"
						onClick={() => {
							this.setState({ openPost: null });
							this.props.setActivePanel("channels");
						}}
					>
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
					<div className="channel-list vscroll" onClick={this.handleClickPost}>
						{sections.map(section => {
							return this.renderSection(section, displayPosts[section] || []);
						})}
						<div className="shadow-cover-bottom" />
					</div>
				</div>
			</div>
		);
	}

	handleClickAddKnowledge = e => {
		e.stopPropagation();
		this.props.setMultiCompose(this.props.knowledgeType);
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
			console.log("RETURNING FALSE");
			return true;
			// if the user clicked on the checkmark; toggle status
			// return this.toggleStatus(postDiv.id);
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
		const isOpen = this.state.openPost === id;
		if (isOpen) this.setState({ openPost: null });
		else {
			const post = this.props.posts.find(post => id === post.id);
			if (post) this.props.showCode(post, true);
			this.setState({ openPost: id });
		}
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

	const user = users[session.userId];

	const postsByType = getAllPostsOfType(posts);

	return {
		umis,
		users,
		teammates: teamMembers,
		team: teams[context.currentTeamId],
		posts: postsByType.map(post => {
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
		setCurrentStream,
		showCode
	}
)(SimpleKnowledgePanel);
