import React, { Component } from "react";
import { connect } from "react-redux";
import createClassString from "classnames";
import _ from "underscore";
import {
	createStream,
	setCurrentStream,
	setUserPreference,
	showCode,
	showMarkersInEditor
} from "./actions";
import { getAllPostsOfType } from "../reducers/streams";
import Icon from "./Icon";
import Tooltip from "./Tooltip";
import Post from "./Post";
import Menu from "./Menu";
import EventEmitter from "../event-emitter";

export class SimpleKnowledgePanel extends Component {
	disposables = [];

	constructor(props) {
		super(props);

		this.state = {
			knowledgeType: "all",
			fileFilter: "all",
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
			all: "all markers",
			comment: "code comments",
			question: "questions & answers",
			issue: "issues",
			trap: "code traps",
			snippet: "snippets",
			bookmark: "bookmarks"
		};
		this.fileFiltersLabelsLower = {
			only: "in current file only",
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
		this.disposables.push(
			EventEmitter.subscribe("interaction:active-editor-changed", this.handleFileChangedEvent)
		);
	}

	componentWillUnmount() {
		this.disposables.forEach(d => d.dispose());
	}

	handleFileChangedEvent = body => {
		if (body && body.editor && body.editor.fileName)
			this.setState({ thisFile: body.editor.fileName, thisRepo: body.editor.repoId });
		// else this.setState({ thisFile: null });
	};

	toggleSection = (e, section) => {
		e.stopPropagation();
		this.setState({
			expanded: { ...this.state.expanded, [section]: !this.state.expanded[section] }
		});
	};

	renderPosts = posts => {
		const { knowledgeType } = this.state;
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
							q={this.props.q}
							showStatus={post.type === "issue"}
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
			section === "inThisFile" && this.state.thisFile ? (
				<span>
					In This File: <span className="filename">{this.state.thisFile}</span>
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
		const { posts, currentUserId } = this.props;
		const { knowledgeType, thisFile, thisRepo, fileFilter } = this.state;

		// if (!knowledgeType) return null;

		const inactive = this.props.activePanel !== "knowledge";
		const shrink = this.props.activePanel === "main" || this.props.activePanel === "thread";

		const knowledgePanelClass = createClassString({
			panel: true,
			"knowledge-panel": true
			// shrink,
			// "off-right": inactive && !shrink
		});

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
			if (knowledgeType !== "all" && postType !== knowledgeType) return null;
			if (postType === "comment" && (!post.codeBlocks || !post.codeBlocks.length)) return null;
			const codeBlock = post.codeBlocks && post.codeBlocks.length && post.codeBlocks[0];
			const codeBlockFile = codeBlock && codeBlock.file;
			const codeBlockRepo = codeBlock && codeBlock.repoId;
			sectionFilters.forEach(section => {
				if (assignedPosts[post.id]) return;
				// if (!this.state.expanded[section]) return;
				if (
					this.props.q &&
					!(post.text || "").includes(this.props.q) &&
					!(post.title || "").includes(this.props.q)
				)
					return;
				if (this.state.fileFilter === "only" && section !== "inThisFile") return;
				if (this.state.fileFilter === "repo" && codeBlockRepo !== thisRepo) return;
				if (this.state.fileFilter === "unseparated" && section === "inThisFile") return;
				switch (section) {
					case "inThisFile":
						if (thisFile && codeBlockFile === thisFile) assignPost(post, "inThisFile");
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

		let typeMenuItems = [
			{ label: "All Markers", action: "set-type-all" },
			{ label: "Code Comments", action: "set-type-comment" },
			{ label: "Questions & Answers", action: "set-type-question" },
			{ label: "Issues", action: "set-type-issue" },
			{ label: "Code Traps", action: "set-type-trap" },
			{ label: "Bookmarks", action: "set-type-bookmark" }
		];

		let fileMenuItems = [
			{ label: "From All Files", action: "set-files-all" },
			{ label: "From All Files, Unseparated", action: "set-files-unseparated" },
			{ label: "In Current Repo Only", action: "set-files-repo" },
			{ label: "In Current File Only", action: "set-files-only" }
		];

		return (
			<div className={knowledgePanelClass}>
				<div className="filters">
					<Tooltip title="Show markers in editor gutter" placement="left">
						<label
							htmlFor="toggle"
							className={createClassString("switch", {
								checked: this.props.showMarkers
							})}
							onClick={this.toggleShowMarkers}
						/>
					</Tooltip>
					Show{" "}
					<span className="filter" onClick={this.toggleTypeMenu}>
						{this.typeLabelsLower[knowledgeType]}
						<Icon name="triangle-down" className="triangle-down" />
						{this.state.typeMenuOpen && (
							<Menu
								items={typeMenuItems}
								target={this.state.menuTarget}
								action={this.handleSelectMenu}
								align="center"
							/>
						)}
					</span>
					<span className="filter" onClick={this.toggleFileMenu}>
						{this.fileFiltersLabelsLower[fileFilter]}
						<Icon name="triangle-down" className="triangle-down" />
						{this.state.fileMenuOpen && (
							<Menu
								items={fileMenuItems}
								target={this.state.menuTarget}
								action={this.handleSelectMenu}
								align="center"
							/>
						)}
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

	toggleShowMarkers = () => {
		const showMarkers = !this.props.showMarkers;
		this.props.showMarkersInEditor(showMarkers);
		// this.setState({ showMarkers });
	};

	handleSelectMenu = action => {
		this.setState({ typeMenuOpen: false, fileMenuOpen: false });
		switch (action) {
			case "set-type-all":
				this.setState({ knowledgeType: "all" });
				break;
			case "set-type-comment":
				this.setState({ knowledgeType: "comment" });
				break;
			case "set-type-question":
				this.setState({ knowledgeType: "question" });
				break;
			case "set-type-issue":
				this.setState({ knowledgeType: "issue" });
				break;
			case "set-type-trap":
				this.setState({ knowledgeType: "trap" });
				break;
			case "set-type-bookmark":
				this.setState({ knowledgeType: "bookmark" });
				break;
			case "set-files-all":
				this.setState({ fileFilter: "all" });
				break;
			case "set-files-only":
				this.setState({ fileFilter: "only" });
				break;
			case "set-files-unseparated":
				this.setState({ fileFilter: "unseparated" });
				break;
		}
	};

	toggleTypeMenu = event => {
		this.setState({ typeMenuOpen: !this.state.typeMenuOpen, menuTarget: event.target });
	};

	toggleFileMenu = event => {
		this.setState({ fileMenuOpen: !this.state.fileMenuOpen, menuTarget: event.target });
	};

	renderHeader = () => {
		const { knowledgeType } = this.state;
		const knowledgeLabel = this.typeLabels[knowledgeType];

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
		</div>;
	};

	handleClickAddKnowledge = e => {
		e.stopPropagation();
		this.props.setMultiCompose(this.state.knowledgeType);
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
		// const isOpen = this.state.openPost === id;
		// if (isOpen) this.setState({ openPost: null });
		// else {
		const post = this.props.posts.find(post => id === post.id);
		if (post) this.props.showCode(post, true);
		// this.setState({ openPost: id });
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

const mapStateToProps = ({ context, streams, users, teams, umis, posts, session, configs }) => {
	const teamMembers = teams[context.currentTeamId].memberIds.map(id => users[id]).filter(Boolean);
	// .filter(user => user && user.isRegistered);

	const user = users[session.userId];

	const postsByType = getAllPostsOfType(posts);

	return {
		umis,
		users,
		showMarkers: configs.showMarkers,
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
		showCode,
		showMarkersInEditor
	}
)(SimpleKnowledgePanel);
