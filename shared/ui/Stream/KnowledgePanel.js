import React, { Component } from "react";
import { connect } from "react-redux";
import createClassString from "classnames";
import _ from "underscore";
import { createStream, setCurrentStream, showCode, showMarkersInEditor } from "./actions";
import { getAllPostsOfType } from "../reducers/streams";
import Icon from "./Icon";
import Tooltip from "./Tooltip";
import Post from "./Post";
import Menu from "./Menu";
import ScrollBox from "./ScrollBox";
import Filter from "./Filter";
import EventEmitter from "../event-emitter";

export class SimpleKnowledgePanel extends Component {
	disposables = [];

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
			snippet: "Snippets",
			bookmark: "Bookmarks"
		};
		this.typeLabelsLower = {
			all: "all codemarks",
			comment: "code comments",
			question: "questions & answers",
			issue: "issues",
			trap: "code traps",
			snippet: "snippets",
			bookmark: "bookmarks"
		};
		this.fileFiltersLabelsLower = {
			current: "in current file only",
			unseparated: "from all files, unseparated",
			repo: "in the current repo only",
			all: "from all files"
		};
		this.sectionLabel = {
			inThisFile: "In This File",
			mine: "Open Issues Assigned To Me",
			open: "Open",
			recent: "Recent",
			closed: "Closed",
			unanswered: "Unanswered"
		};
		this.sectionsByType = {
			all: ["inThisFile", "mine", "recent"],
			comment: ["inThisFile", "mine", "recent"],
			question: ["inThisFile", "unanswered", "recent"],
			issue: ["inThisFile", "mine", "open", "recent", "closed"],
			trap: ["inThisFile", "recent"],
			bookmark: ["inThisFile", "recent"]
		};
		this.sectionsFilterOrder = {
			all: ["inThisFile", "mine", "recent"],
			comment: ["inThisFile", "mine", "recent"],
			question: ["inThisFile", "unanswered", "recent"],
			issue: ["closed", "inThisFile", "mine", "open", "recent"],
			trap: ["inThisFile", "recent"],
			bookmark: ["inThisFile", "recent"]
		};
	}

	componentDidMount() {
		// this.disposables.push(
		// 	EventEmitter.subscribe("interaction:active-editor-changed", this.handleFileChangedEvent)
		// );
	}

	componentWillUnmount() {
		this.disposables.forEach(d => d.dispose());
	}

	handleFileChangedEvent = body => {
		// if (body && body.editor && body.editor.fileName)
		// 	this.setState({ thisFile: body.editor.fileName, thisRepo: body.editor.repoId });
		// else this.setState({ thisFile: null });
	};

	toggleSection = (e, section) => {
		e.stopPropagation();
		this.setState({
			expanded: { ...this.state.expanded, [section]: !this.state.expanded[section] }
		});
	};

	renderPosts = posts => {
		const { typeFilter } = this.props;
		if (posts.length === 0)
			return <div className="no-matches">No {typeFilter}s in file foo/bar/baz.js</div>;
		else {
			return posts.map(post => {
				const collapsed = this.state.openPost !== post.id;
				const type = post.codemark && post.codemark.type;
				return (
					<div key={post.id}>
						<Post
							id={post.id}
							streamId={post.streamId}
							q={this.props.q}
							showStatus={type === "issue"}
							showAssigneeHeadshots={true}
							alwaysShowReplyCount={!collapsed}
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
		if (posts.length === 0) return null;

		const sectionLabel =
			section === "inThisFile" && this.props.mostRecentSourceFile ? (
				<span>
					In This File: <span className="filename">{this.props.mostRecentSourceFile}</span>
				</span>
			) : (
				this.sectionLabel[section]
			);
		return (
			<div
				className={createClassString("section", "has-children", {
					expanded: this.state.expanded[section]
				})}
			>
				<div className="header" onClick={e => this.toggleSection(e, section)}>
					<Icon name="triangle-right" className="triangle-right" />
					<span className="clickable">{sectionLabel}</span>
				</div>
				<ul>{this.renderPosts(posts)}</ul>
			</div>
		);
	};

	render() {
		const { posts, currentUserId, mostRecentSourceFile, fileFilter, typeFilter } = this.props;
		const { thisRepo } = this.state;

		const sections = this.sectionsByType[typeFilter];

		let displayPosts = {};
		let assignedPosts = {};
		let sectionFilters = this.sectionsFilterOrder[typeFilter] || [];
		let totalPosts = 0;

		const assignPost = (post, section) => {
			if (!displayPosts[section]) displayPosts[section] = [];
			displayPosts[section].push(post);
			assignedPosts[post.id] = true;
			totalPosts++;
		};

		posts.forEach(post => {
			const postType = (post.codemark && post.codemark.type) || "comment";
			if (post.deactivated) return null;
			if (typeFilter !== "all" && postType !== typeFilter) return null;
			if (postType === "comment" && (!post.codeBlocks || !post.codeBlocks.length)) return null;
			const codeBlock = post.codeBlocks && post.codeBlocks.length && post.codeBlocks[0];
			const codeBlockFile = codeBlock && codeBlock.file;
			const codeBlockRepo = codeBlock && codeBlock.repoId;
			const title = post.codemark && post.codemark.title;
			const assignees = post.codemark && post.codemark.assignees;
			const status = post.codemark && post.codemark.status;
			sectionFilters.forEach(section => {
				if (assignedPosts[post.id]) return;
				// if (!this.state.expanded[section]) return;
				if (
					this.props.q &&
					!(post.text || "").includes(this.props.q) &&
					!(title || "").includes(this.props.q)
				)
					return;
				if (fileFilter === "current" && section !== "inThisFile") return;
				if (fileFilter === "repo" && codeBlockRepo !== thisRepo) return;
				if (fileFilter === "unseparated" && section === "inThisFile") return;
				switch (section) {
					case "inThisFile":
						if (mostRecentSourceFile && codeBlockFile === mostRecentSourceFile)
							assignPost(post, "inThisFile");
						break;
					case "mine":
						if (status === "open" || (!status && _.contains(assignees || [], currentUserId)))
							assignPost(post, "mine");
						break;
					case "open":
						if (status === "open" || !status) assignPost(post, "open");
						break;
					case "unanswered":
						if (post.numReplies > 0) assignPost(post, "unanswered");
						break;
					case "recent":
						assignPost(post, "recent");
						break;
					case "closed":
						if (status === "closed") assignPost(post, "closed");
						break;
				}
			});
		});

		let typeMenuItems = [
			{ label: "All Codemarks", action: "all" },
			{ label: "-" },
			{ label: "Code Comments", action: "comment" },
			{ label: "Questions & Answers", action: "question" },
			{ label: "Issues", action: "issue" },
			{ label: "Code Traps", action: "trap" },
			{ label: "Bookmarks", action: "bookmark" }
		];

		let fileMenuItems = [
			{ label: "From All Files", action: "all" },
			{ label: "From All Files, Unseparated", action: "unseparated" },
			// { label: "In Current Repo Only", action: "repo" },
			{ label: "In Current File Only", action: "current" }
		];

		return (
			<div className="panel knowledge-panel">
				<div className="filters">
					<Tooltip title="Show codemarks in editor gutter" placement="left">
						<label
							htmlFor="toggle"
							className={createClassString("switch", {
								checked: this.props.showMarkers
							})}
							onClick={this.toggleShowMarkers}
						/>
					</Tooltip>
					Show{" "}
					<Filter
						preferenceId="markerTypeFilter"
						selected={typeFilter}
						labels={this.typeLabelsLower}
						items={typeMenuItems}
					/>
					<Filter
						preferenceId="markerFileFilter"
						selected={fileFilter}
						labels={this.fileFiltersLabelsLower}
						items={fileMenuItems}
					/>
				</div>
				<ScrollBox>
					<div className="channel-list vscroll" onClick={this.handleClickPost}>
						{totalPosts > 0 &&
							sections.map(section => {
								return this.renderSection(section, displayPosts[section] || []);
							})}
						{!totalPosts && <div className="no-matches">No codemarks match this type.</div>}
					</div>
				</ScrollBox>
			</div>
		);
	}

	toggleShowMarkers = () => {
		const showMarkers = !this.props.showMarkers;
		this.props.showMarkersInEditor(showMarkers);
		// this.setState({ showMarkers });
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
		// const isOpen = this.state.openPost === id;
		// if (isOpen) this.setState({ openPost: null });
		// else {
		const post = this.props.posts.find(post => id === post.id);
		if (post) this.props.showCode(post, true);
		// this.setState({ openPost: id });
		// this.props.setCurrentStream(post.streamId);
		this.props.postAction("make-thread", post);
		// }
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

const mapStateToProps = ({ context, users, teams, preferences, umis, posts, session, configs }) => {
	const teamMembers = teams[context.currentTeamId].memberIds.map(id => users[id]).filter(Boolean);
	// .filter(user => user && user.isRegistered);

	const postsByType = getAllPostsOfType(posts);

	return {
		umis,
		users,
		showMarkers: configs.showMarkers,
		teammates: teamMembers,
		team: teams[context.currentTeamId],
		fileFilter: preferences.markerFileFilter || "all",
		typeFilter: preferences.markerTypeFilter || "all",
		mostRecentSourceFile: context.mostRecentSourceFile,
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
		setCurrentStream,
		showCode,
		showMarkersInEditor
	}
)(SimpleKnowledgePanel);
