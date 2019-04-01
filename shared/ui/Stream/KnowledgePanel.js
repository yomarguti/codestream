import React, { Component } from "react";
import { connect } from "react-redux";
import createClassString from "classnames";
import * as actions from "./actions";
import * as codemarkSelectors from "../store/codemarks/reducer";
import * as userSelectors from "../store/users/reducer";
import Icon from "./Icon";
import ScrollBox from "./ScrollBox";
import Filter from "./Filter";
import Codemark from "./Codemark";
import { HostApi } from "../webview-api";
import { DocumentFromMarkerRequestType, TelemetryRequestType } from "@codestream/protocols/agent";
import { EditorRevealRangeRequestType } from "../ipc/webview.protocol";
import { includes as _includes, sortBy as _sortBy } from "lodash-es";
import { setCurrentStream } from "../store/context/actions";

export class SimpleKnowledgePanel extends Component {
	disposables = [];

	constructor(props) {
		super(props);

		this.state = {
			isLoading: props.codemarks.length === 0,
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
			// question: "Questions & Answers",
			issue: "Issues",
			trap: "Traps",
			snippet: "Snippets",
			bookmark: "Bookmarks"
		};
		this.typeLabelsLower = {
			all: "all codemarks",
			comment: "code comments",
			// question: "questions & answers",
			issue: "issues",
			trap: "traps",
			snippet: "snippets",
			bookmark: "bookmarks"
		};
		this.fileFiltersLabelsLower = {
			current: "in current file only",
			unseparated: "from all files, unseparated",
			repo: "in the current repo only",
			all: "from all files"
		};
		this.colorFiltersLabelsLower = {
			all: "with any color",
			blue: "that are blue",
			green: "that are green",
			yellow: "that are yellow",
			orange: "that are orange",
			red: "that are red",
			purple: "that are purple",
			aqua: "that are aqua",
			gray: "that are gray"
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
			all: ["mine", "recent"],
			comment: ["mine", "recent"],
			question: ["unanswered", "recent"],
			issue: ["mine", "open", "recent", "closed"],
			trap: ["recent"],
			bookmark: ["recent"]
			// all: ["inThisFile", "mine", "recent"],
			// comment: ["inThisFile", "mine", "recent"],
			// question: ["inThisFile", "unanswered", "recent"],
			// issue: ["inThisFile", "mine", "open", "recent", "closed"],
			// trap: ["inThisFile", "recent"],
			// bookmark: ["inThisFile", "recent"]
		};
		this.sectionsFilterOrder = {
			all: ["mine", "recent"],
			comment: ["mine", "recent"],
			question: ["unanswered", "recent"],
			issue: ["closed", "mine", "open", "recent"],
			trap: ["recent"],
			bookmark: ["recent"]
			// all: ["inThisFile", "mine", "recent"],
			// comment: ["inThisFile", "mine", "recent"],
			// question: ["inThisFile", "unanswered", "recent"],
			// issue: ["closed", "inThisFile", "mine", "open", "recent"],
			// trap: ["inThisFile", "recent"],
			// bookmark: ["inThisFile", "recent"]
		};
	}

	componentDidMount() {
		if (this.props.codemarks.length === 0)
			this.props.fetchCodemarks().then(() => {
				this.setState({ isLoading: false });
			});
		// this.disposables.push(
		// 	EventEmitter.subscribe("interaction:active-editor-changed", this.handleFileChangedEvent)
		// );
		if (this._searchInput) this._searchInput.focus();
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

	renderPosts = codemarks => {
		const { typeFilter } = this.props;
		if (codemarks.length === 0)
			return <div className="no-matches">No {typeFilter}s in this file.</div>;
		else {
			return codemarks.map(codemark => {
				return (
					<Codemark
						key={codemark.id}
						codemark={codemark}
						collapsed={this.state.openPost !== codemark.id}
						currentUserName={this.props.currentUserName}
						usernames={this.props.usernames}
						onClick={this.handleClickCodemark}
						action={this.props.postAction}
						query={this.state.q}
					/>
				);
			});
		}
	};

	renderSection = (section, codemarks) => {
		if (codemarks.length === 0) return null;

		const sectionLabel =
			section === "inThisFile" && this.props.fileNameToFilterFor ? (
				<span>
					In This File: <span className="filename">{this.props.fileNameToFilterFor}</span>
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
				<ul>{this.renderPosts(codemarks)}</ul>
			</div>
		);
	};

	render() {
		if (this.state.isLoading) return null;

		if (this.props.noCodemarksAtAll) {
			return this.renderBlankFiller();
		}

		const {
			codemarks,
			currentUserId,
			fileNameToFilterFor,
			fileStreamIdToFilterFor,
			fileFilter,
			typeFilter,
			colorFilter
		} = this.props;
		const { thisRepo } = this.state;

		const sections = this.sectionsByType[typeFilter];

		let displayCodemarks = {};
		let assignedCodemarks = {};
		let sectionFilters = this.sectionsFilterOrder[typeFilter] || [];
		let totalCodemarks = 0;

		const assignCodemark = (codemark, section) => {
			if (!displayCodemarks[section]) displayCodemarks[section] = [];
			displayCodemarks[section].push(codemark);
			assignedCodemarks[codemark.id] = true;
			totalCodemarks++;
		};

		// sort by most recent first
		_sortBy(codemarks, codemark => -codemark.createdAt).forEach(codemark => {
			const codemarkType = codemark.type || "comment";
			if (codemark.deactivated) return null;
			if (typeFilter !== "all" && codemarkType !== typeFilter) return null;
			if (colorFilter !== "all" && codemark.color !== colorFilter) return null;

			const codeBlock = codemark.markers && codemark.markers.length && codemark.markers[0];

			const codeBlockRepo = codeBlock && codeBlock.repoId;
			const title = codemark.title;
			const assignees = codemark.assignees;
			const status = codemark.status;
			const q = this.state.q ? this.state.q.toLocaleLowerCase() : null;

			sectionFilters.forEach(section => {
				if (assignedCodemarks[codemark.id]) return;
				// if (!this.state.expanded[section]) return;

				if (
					q &&
					!(codemark.text || "").toLocaleLowerCase().includes(q) &&
					!(title || "").toLocaleLowerCase().includes(q)
				)
					return;
				if (fileFilter === "current" && section !== "inThisFile") return;
				if (fileFilter === "repo" && codeBlockRepo !== thisRepo) return;
				if (fileFilter === "unseparated" && section === "inThisFile") return;
				switch (section) {
					case "inThisFile":
						if (
							fileNameToFilterFor &&
							(codemark.fileStreamIds || []).includes(fileStreamIdToFilterFor)
						)
							assignCodemark(codemark, "inThisFile");
						break;
					case "mine":
						if ((status === "open" || !status) && _includes(assignees || [], currentUserId))
							assignCodemark(codemark, "mine");
						break;
					case "open":
						if (status === "open" || !status) assignCodemark(codemark, "open");
						break;
					case "unanswered":
						if (codemark.numReplies > 0) assignCodemark(codemark, "unanswered");
						break;
					case "recent":
						assignCodemark(codemark, "recent");
						break;
					case "closed":
						if (status === "closed") assignCodemark(codemark, "closed");
						break;
				}
			});
		});

		let typeMenuItems = [
			{ label: "All Codemarks", action: "all" },
			{ label: "-" },
			{ label: "Code Comments", action: "comment" },
			// { label: "Questions & Answers", action: "question" },
			{ label: "Issues", action: "issue" },
			// { label: "Traps", action: "trap" },
			{ label: "Bookmarks", action: "bookmark" }
		];

		let fileMenuItems = [
			{ label: "From All Files", action: "all" },
			{ label: "From All Files, Unseparated", action: "unseparated" },
			// { label: "In Current Repo Only", action: "repo" },
			{ label: "In Current File Only", action: "current" }
		];
		let colorMenuItems = [
			{ label: "Any Color", action: "all" },
			{ label: "Blue", action: "blue" },
			{ label: "Green", action: "green" },
			{ label: "Yellow", action: "yellow" },
			{ label: "Orange", action: "orange" },
			{ label: "Red", action: "red" },
			{ label: "Purple", action: "purple" },
			{ label: "Aqua", action: "aqua" },
			{ label: "Gray", action: "gray" }
		];

		return (
			<div className="panel knowledge-panel">
				<div className="search-bar">
					<input
						name="q"
						className="native-key-bindings input-text control"
						type="text"
						ref={ref => (this._searchInput = ref)}
						onChange={e => this.setState({ q: e.target.value })}
						placeholder="Search Codemarks"
					/>
				</div>

				<div className="filters">
					Show{" "}
					<Filter
						onValue={this.props.setCodemarkTypeFilter}
						selected={typeFilter}
						labels={this.typeLabelsLower}
						items={typeMenuItems}
					/>
					<Filter
						onValue={this.props.setCodemarkColorFilter}
						selected={colorFilter}
						labels={this.colorFiltersLabelsLower}
						items={colorMenuItems}
					/>
				</div>
				<ScrollBox>
					<div className="channel-list vscroll">
						{totalCodemarks > 0 &&
							sections.map(section => {
								return this.renderSection(section, displayCodemarks[section] || []);
							})}
						{!totalCodemarks && <div className="no-matches">No codemarks match this type.</div>}
					</div>
				</ScrollBox>
			</div>
		);
	}

	renderBlankFiller() {
		return (
			<div className="panel codemarks-panel">
				<div className="getting-started">
					<div>
						<p>
							Codemarks are the building blocks of your team’s knowledge base.{" "}
							<a href="https://github.com/TeamCodeStream/CodeStream/wiki/Building-a-Knowledge-Base-with-Codemarks">
								Learn more about how to use codemarks.
							</a>
						</p>
					</div>
					<div className="info">
						<div className="codemark-info" onClick={this.onClickCodemarkTypeFor("comment")}>
							<Icon name="comment" className="type-icon" />
							<div className="text">
								<h3>Comment</h3>
								<p>Link any type of comment or question to a block of code.</p>
							</div>
						</div>
						<div className="codemark-info" onClick={this.onClickCodemarkTypeFor("issue")}>
							<Icon name="issue" className="type-icon" />
							<div className="text">
								<h3>Issue</h3>
								<p>See some code that needs to be fixed or refactored? Assign an issue.</p>
							</div>
						</div>
						{
							// <div className="codemark-info" onClick={this.onClickCodemarkTypeFor("trap")}>
							// 	<Icon name="trap" className="type-icon" />
							// 	<div className="text">
							// 		<h3>Code Trap</h3>
							// 		<p>
							// 			Create a trap around code that shouldn’t be touched without talking to you first.
							// 		</p>
							// 	</div>
							// </div>
						}
						<div className="codemark-info" onClick={this.onClickCodemarkTypeFor("bookmark")}>
							<Icon name="bookmark" className="type-icon" />
							<div className="text">
								<h3>Bookmark</h3>
								<p>Bookmark parts of the code you want to be able to get back to quickly.</p>
							</div>
						</div>
						<div className="codemark-info" onClick={this.onClickCodemarkTypeFor("link")}>
							<Icon name="link" className="type-icon" />
							<div className="text">
								<h3>Permalink</h3>
								<p>Get a shareable link to a block of code.</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	}

	onClickCodemarkTypeFor = type => e => {
		e.preventDefault();
		this.props.setMultiCompose(true, {
			codemarkType: type
		});
	};

	handleClickCodemark = async codemark => {
		HostApi.instance.send(TelemetryRequestType, {
			eventName: "Codemark Clicked",
			properties: {
				"Codemark Location": "Codemarks Tab"
			}
		});

		if (codemark.markers) {
			try {
				const response = await HostApi.instance.send(DocumentFromMarkerRequestType, {
					markerId: codemark.markers[0].id
				});
				// TODO: What should we do if we don't find the marker?
				if (response) {
					HostApi.instance.send(EditorRevealRangeRequestType, {
						uri: response.textDocument.uri,
						range: response.range,
						preserveFocus: true
					});
				}
			} catch (error) {
				// TODO: likely because the file no longer exists
			}
		}
		this.props.setCurrentStream(codemark.streamId, codemark.parentPostId || codemark.postId);
		// const isOpen = this.state.openPost === id;
		// if (isOpen) this.setState({ openPost: null });
		// else {
		// this.setState({ openPost: id });
		// }
	};

	toggleStatus = id => {
		this.setState({
			statusPosts: { ...this.state.statusPosts, [id]: !this.state.statusPosts[id] }
		});
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

const mapStateToProps = state => {
	const { capabilities, context, teams, configs } = state;

	let fileNameToFilterFor;
	let fileStreamIdToFilterFor;
	if (context.activeFile && context.fileStreamId) {
		fileNameToFilterFor = context.activeFile;
		fileStreamIdToFilterFor = context.fileStreamId;
	} else if (context.activeFile && !context.fileStreamId) {
		fileNameToFilterFor = context.activeFile;
	} else {
		fileNameToFilterFor = context.lastActiveFile;
		fileStreamIdToFilterFor = context.lastFileStreamId;
	}

	return {
		usernames: userSelectors.getUsernames(state),
		noCodemarksAtAll: !codemarkSelectors.teamHasCodemarks(state),
		codemarks: codemarkSelectors.getTypeFilteredCodemarks(state),
		team: teams[context.currentTeamId],
		fileFilter: context.codemarkFileFilter,
		typeFilter: context.codemarkTypeFilter,
		colorFilter: context.codemarkColorFilter,
		fileNameToFilterFor,
		fileStreamIdToFilterFor,
		capabilities
	};
};

export default connect(
	mapStateToProps,
	{ ...actions, setCurrentStream }
)(SimpleKnowledgePanel);
