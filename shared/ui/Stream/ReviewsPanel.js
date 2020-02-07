import React, { Component } from "react";
import { connect } from "react-redux";
import createClassString from "classnames";
import * as actions from "./actions";
import * as reviewSelectors from "../store/reviews/reducer";
import * as userSelectors from "../store/users/reducer";
import Tag from "./Tag";
import Menu from "./Menu";
import Icon from "./Icon";
import ScrollBox from "./ScrollBox";
import Filter from "./Filter";
import SearchResult from "./SearchResult";
import { ProTip } from "./ProTip";
import Headshot from "./Headshot";
import { HostApi } from "../webview-api";
import { includes as _includes, sortBy as _sortBy, filter } from "lodash-es";
import { PanelHeader } from "../src/components/PanelHeader";
import styled from "styled-components";
import FiltersButton from "../src/components/FiltersButton";
import { OpenUrlRequestType } from "@codestream/protocols/agent";

const SearchBar = styled.div`
	display: flex;
	flex-direction: row;
	input.control {
		padding-left: 32px !important;
		// the bookmark icon is narrower so requires less space
		padding-right: 25px !important;
		height: 100%;
	}
	.search-input {
		position: relative;
		flex-grow: 10;
		width: 100%;
		.icon.search {
			position: absolute;
			left: 8px;
			top: 6px;
			opacity: 0.5;
		}
		.save {
			position: absolute;
			right: 6px;
			top: 6px;
			opacity: 0.5;
			&:hover {
				opacity: 1;
			}
		}
	}
`;

const SaveFilter = styled.div`
	position: relative;
	display: inline-block;
	margin: -1px 0 -1px 0;
	input.control {
		width: 8em;
		font-size: 12px !important;
		padding-left: 24px !important;
		&::placeholder {
			font-size: 12px !important;
		}
	}
	.icon.bookmark {
		position: absolute;
		left: 5px;
		top: 4px;
		opacity: 0.5;
	}
`;

const SavedFilter = styled.div`
	position: relative;
	display: inline-block;
	label {
		font-size: 12px !important;
		cursor: pointer;
		display: inline-block;
		padding: 3px 5px 3px 5px;
		&:hover {
			color: var(--text-color-highlight);
		}
	}
	.icon.bookmark {
		opacity: 0.75;
	}
	.icon.gear {
		display: inline-block;
		padding-left: 5px;
		visibility: hidden;
		opacity: 0.5;
		cursor: pointer;
		&:hover {
			opacity: 1;
		}
	}
	&:hover {
		.icon.gear {
			visibility: visible;
		}
	}
`;

const sameDay = (d1, d2) => {
	return (
		d1.getFullYear() === d2.getFullYear() &&
		d1.getMonth() === d2.getMonth() &&
		d1.getDate() === d2.getDate()
	);
};

export class SimpleReviewsPanel extends Component {
	disposables = [];

	constructor(props) {
		super(props);

		this.state = {
			isLoading: props.reviews.length === 0,
			openPost: null,
			expanded: {
				waitingForMe: true,
				createdByMe: true,
				open: true,
				closed: true
			},
			selectedTags: {},
			filters: {},
			savedFilters: props.savedSearchFilters
		};

		this.sectionLabel = {
			waitingForMe: "Waiting For My Review",
			createdByMe: "Created By Me",
			open: "Open",
			closed: "Closed"
		};
	}

	componentDidMount() {
		if (this.props.webviewFocused)
			HostApi.instance.track("Page Viewed", { "Page Name": "Reviews" });
		if (false && this.props.reviews.length === 0)
			this.props.fetchReviews().then(() => {
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

	toggleSection = (e, section) => {
		e.stopPropagation();
		this.setState({
			expanded: { ...this.state.expanded, [section]: !this.state.expanded[section] }
		});
	};

	renderReviews = reviews => {
		const { typeFilter } = this.props;
		if (reviews.length === 0)
			return <div className="no-matches">No {typeFilter}s in this file.</div>;
		else {
			return reviews.map(review => (
				<SearchResult review={review} query={this.state.filters.text} />
			));
		}
	};

	renderSection = (section, reviews) => {
		if (reviews.length === 0) return null;

		const sectionLabel = this.sectionLabel[section];

		return (
			<div
				className={createClassString("section", "has-children", {
					expanded: this.state.expanded[section]
				})}
			>
				<div className="header" onClick={e => this.toggleSection(e, section)}>
					<Icon name="chevron-right" className="triangle-right" />
					<span className="clickable">{sectionLabel}</span>
				</div>
				<ul>{this.renderReviews(reviews)}</ul>
			</div>
		);
	};

	hasTag = (review, tagFilter) => {
		const { teamTagsArray } = this.props;
		if (tagFilter === "all") return true;

		let reviewTags = review.tags || [];
		return reviewTags.find(reviewTagId => {
			const teamTag = teamTagsArray.find(tag => tag.id === reviewTagId);
			return teamTag && (teamTag.label === tagFilter || teamTag.color === tagFilter);
		});
	};

	onBranch = (review, branchFilter) => {
		if (branchFilter === "all") return true;
		return review.branch === branchFilter;
	};

	// when the query changes, parse it for different types of
	// filters, and leave behind any non-filters as keywords
	// to search for -- those keywords are left in the `text` variable
	setQ = q => {
		const me = this.props.currentUsername.toLowerCase();
		let text = q;
		const filters = {};
		let match;

		if (text.match(/\bis:open\b/)) {
			filters.status = "open";
			text = text.replace(/\s*is:open\s*/, " ");
		}
		if (text.match(/\bis:closed\b/)) {
			filters.status = "closed";
			text = text.replace(/\s*is:closed\s*/, " ");
		}
		if (text.match(/\bis:issue\b/)) {
			filters.type = "issue";
			text = text.replace(/\s*is:issue\s*/, " ");
		}
		if (text.match(/\bis:cr\b/)) {
			filters.type = "review";
			text = text.replace(/\s*is:cr\s*/, " ");
		}
		match = text.match(/\bauthor:@(\S+)(\s|$)/);
		if (match) {
			filters.author = match[1] === "me" ? me : match[1].toLowerCase();
			text = text.replace(/\s*author:@\S+/, " ");
		}
		match = text.match(/\bimpacts:@(\S+)(\s|$)/);
		if (match) {
			filters.impacts = match[1] === "me" ? me : match[1].toLowerCase();
			text = text.replace(/\s*impacts:@\S+/, " ");
		}
		match = text.match(/\bassignee:@(\S+)(\s|$)/);
		if (match) {
			filters.assignee = match[1];
			text = text.replace(/\s*assignee:@\S+/, " ");
		}
		match = text.match(/\breviewer:@(\S+)[\s|$]/);
		if (match) {
			filters.assignee = match[1] === "me" ? me : match[1].toLowerCase();
			text = text.replace(/\s*reviewer:@\S+/, " ");
		}
		match = text.match(/\btag:\"(.*?)\"(\s|$)/);
		if (match) {
			filters.tag = match[1];
			text = text.replace(/\s*tag:\"(.*?)\"\s*/, " ");
		}
		match = text.match(/\btag:(\S+)(\s|$)/);
		if (match) {
			filters.tag = match[1];
			text = text.replace(/\s*tag:(\S+)\s*/, " ");
		}
		if (text.match(/\bno:tag\b/)) {
			filters.noTag = true;
			text = text.replace(/\s*no:tag\s*/, " ");
		}
		match = text.match(/\bbranch:\"(.*?)\"(\s|$)/);
		if (match) {
			filters.branch = match[1];
			text = text.replace(/\s*branch:\"(.*?)\"\s*/, " ");
		}
		match = text.match(/\bbranch:(\S+)(\s|$)/);
		if (match) {
			filters.branch = match[1];
			text = text.replace(/\s*branch:(\S+)\s*/, " ");
		}
		match = text.match(/\bupdated:([<>]?)(\d\d\d\d)-(\d+)-(\d+)(\s|$)/);
		if (match) {
			const date = new Date(match[2], match[3] - 1, match[4]);
			if (match[1] === "<") filters.updatedBefore = date.getTime();
			if (match[1] === ">") filters.updatedAfter = date.getTime();
			if (!match[1]) filters.updatedOn = date;
			text = text.replace(/\s*updated:[<>]?(\S+)\s*/, " ");
		}
		match = text.match(/\bcreated:([<>]?)(\d\d\d\d)-(\d+)-(\d+)(\s|$)/);
		if (match) {
			const date = new Date(match[2], match[3] - 1, match[4]);
			if (match[1] === "<") filters.createdBefore = date.getTime();
			if (match[1] === ">") filters.createdAfter = date.getTime();
			if (!match[1]) filters.createdOn = date;
			text = text.replace(/\s*created:[<>]?(\S+)\s*/, " ");
		}

		filters.text = text.trim();

		this.setState({ filters, q });
	};

	saveFilter = () => {
		this.setState({ savingFilter: true });
		setTimeout(() => {
			if (this._saveFilterInput) this._saveFilterInput.focus();
		}, 200);
	};

	saveFilterSubmit = (label, q, index) => {
		if (!q || q.length === 0) return;
		let savedFilters = [];
		if (index == undefined) {
			savedFilters = [...this.state.savedFilters, { label, q }];
		} else {
			savedFilters = [...this.state.savedFilters];
			savedFilters.splice(index, 1, { label, q });
		}

		this.props.setUserPreference(["savedSearchFilters"], [...savedFilters]);
		this.setState({
			savedFilters,
			savingFilter: false,
			editingFilterIndex: undefined,
			editingFilterLabel: ""
		});
	};

	deleteSavedFilter = index => {
		const savedFilters = [...this.state.savedFilters];
		savedFilters.splice(index, 1);
		this.setState({ savedFilters });
		this.props.setUserPreference(["savedSearchFilters"], [...savedFilters, { label: "", q: "" }]);
	};

	renderSaveFilter = index => {
		const { savedFilters, editingFilterLabel } = this.state;
		const value = index == undefined ? "" : savedFilters[index].label;
		const q = index == undefined ? this.state.q : savedFilters[index].q;
		return (
			<SaveFilter>
				<input
					value={editingFilterLabel}
					autoFocus={true}
					placeholder="Filter name"
					ref={ref => (this._saveFilterInput = ref)}
					className="input-text control"
					type="text"
					onChange={e => this.setState({ editingFilterLabel: e.target.value })}
					onBlur={e => this.saveFilterSubmit(e.target.value, q, index)}
				/>
				<Icon name="bookmark" className="bookmark" />
			</SaveFilter>
		);
	};

	editSavedFilter = index => {
		const label = this.state.savedFilters[index].label;
		this.setState({ editingFilterIndex: index, editingFilterLabel: label });
		// FIXME -- focus the damn thing
	};

	render() {
		// if (this.state.isLoading) return null;

		if (false && this.props.noReviewsAtAll) {
			return this.renderBlankFiller();
		}

		const { reviews, currentUserId, authorArray, branchArray, repoArray, usernameMap } = this.props;
		const { thisRepo, filters, savedFilters } = this.state;

		const sections = ["waitingForMe", "createdByMe", "open", "closed"];

		let displayReviews = {};
		let assignedReviews = {};
		let totalReviews = 0;

		const assignReview = (review, section) => {
			if (!displayReviews[section]) displayReviews[section] = [];
			displayReviews[section].push(review);
			assignedReviews[review.id] = true;
			totalReviews++;
		};

		// sort by most recent first
		_sortBy(reviews, review => -review.createdAt).forEach(review => {
			// console.log("REVIEW IS: ", review);
			if (review.deactivated) return null;
			// FIXME author is text, creatorId is an id
			const creator = usernameMap[review.creatorId];
			const assignees = review.reviewers.map(id => usernameMap[id]);
			const impacted = Object.keys(review.authorsById || {}).map(id => usernameMap[id]);
			if (filters.author && creator !== filters.author) return null;
			if (filters.impacts && !impacted.includes(filters.impacts)) return null;
			if (filters.assignee && !assignees.includes(filters.assignee)) return null;
			if (filters.status && review.status !== filters.status) return null;
			if (filters.tag && !this.hasTag(review, filters.tag)) return null;
			// FIXME this will only work if we have issues in this query as well
			if (filters.type && filters.type !== "review") return null;
			if (filters.noTag && review.tags && review.tags.length) return null;
			if (filters.branch) {
				const branches = (review.reviewChangeset || []).map(changeset => changeset.branch);
				if (!branches.includes(filters.branch)) return null;
			}
			if (filters.repo) {
				const repoIds = (review.reviewChangeset || []).map(changeset => changeset.repoId);
				if (!repoIds.includes(filters.repoId)) return null;
			}
			if (filters.updatedAfter && review.modifiedAt < filters.updatedAfter) return null;
			if (filters.updatedBefore && review.modifiedAt > filters.updatedBefore) return null;
			if (filters.updatedOn && !sameDay(new Date(review.modifiedAt), filters.updatedOn))
				return null;
			if (filters.createdAfter && review.createdAt < filters.createdAfter) return null;
			if (filters.createdBefore && review.createdAt > filters.createdBefore) return null;
			if (filters.createdOn && !sameDay(new Date(review.createdAt), filters.createdOn)) return null;
			// if (!this.onBranch(review, branchFilter)) return null;

			const title = review.title;
			const reviewers = review.reviewers;
			const status = review.status;
			const q = filters.text;

			sections.forEach(section => {
				if (assignedReviews[review.id]) return;

				if (
					q &&
					!(review.text || "").toLocaleLowerCase().includes(q) &&
					!(title || "").toLocaleLowerCase().includes(q)
				)
					return;
				switch (section) {
					case "waitingForMe":
						if ((status === "open" || !status) && _includes(reviewers || [], currentUserId))
							assignReview(review, "waitingForMe");
						break;
					case "createdByMe":
						if (review.creatorId === currentUserId) assignReview(review, "createdByMe");
						break;
					case "open":
						if (status === "open" || !status) assignReview(review, "open");
						break;
					default:
						assignReview(review, "closed");
						break;
				}
			});
		});

		const tagMenuItems = this.props.teamTagsArray.map(tag => {
			const color = tag.color.startsWith("#") ? "" : tag.color;
			let className = "tag-menu-block wide";
			if (!tag.color.startsWith("#")) className += " " + tag.color + "-background";
			let label = tag.label || color;
			if (label.match(/\s/)) label = `"${label}"`;
			return {
				label: (
					<span className="tag-menu-selector">
						<span
							className={className}
							style={tag.color.startsWith("#") ? { background: tag.color } : {}}
						>
							{tag.label || <span>&nbsp;</span>}
						</span>
					</span>
				),
				noHover: true,
				searchLabel: tag.label || tag.color,
				action: e => this.setQ(`tag:${label}`)
			};
		});

		const branchMenuItems = Object.keys(branchArray)
			.sort()
			.map(branch => {
				return {
					label: (
						<span className="branch-menu-selector">
							<Icon name="git-branch" /> {branch}
						</span>
					),
					searchLabel: branch,
					key: branch,
					action: e => this.setQ(`branch:"${branch}"`)
				};
			});

		const repoMenuItems = Object.keys(repoArray)
			.sort()
			.map(repo => {
				return {
					label: (
						<span className="repo-menu-selector">
							<Icon name="git-repo" /> {repo}
						</span>
					),
					searchLabel: repo,
					key: repo,
					action: e => this.setQ(`repo:"${repo}"`)
				};
			});

		// BY REPO?

		// let authorMenuItems = [{ label: "Anyone", action: "all" }, { label: "-" }];
		// authorMenuItems = authorMenuItems.concat(
		// 	Object.values(authorArray)
		// 		// .sort((a, b) => a.fullName )
		// 		.map(author => {
		// 			return {
		// 				label: (
		// 					<span className="branch-menu-selector">
		// 						<Headshot size={18} person={author} />
		// 						{author.name}
		// 					</span>
		// 				),
		// 				searchLabel: author.name,
		// 				action: author.codestreamId || author.id
		// 			};
		// 		})
		// );

		const filterItems = [
			{ label: "Open Issues and Code Reviews", key: "open", action: () => this.setQ("is:open") },
			{
				label: "Your Issues",
				key: "issues",
				action: () => this.setQ("is:open is:issue author:@me")
			},
			{
				label: "Your Code Reviews",
				key: "reviews",
				action: () => this.setQ("is:open is:cr author:@me ")
			},
			{
				label: "Everything assigned to you",
				key: "assigned",
				action: () => this.setQ("is:open assignee:@me ")
			},
			{
				label: "Everything mentioning you",
				key: "mine",
				action: () => this.setQ("is:open mentions:@me ")
			},
			{
				label: "Everything impacting code you wrote",
				key: "mycode",
				action: () => this.setQ("impacts:@me ")
			},
			{ label: "By Tag", key: "tag", submenu: tagMenuItems },
			{ label: "By Repo", key: "repo", submenu: repoMenuItems },
			{ label: "By Branch", key: "branch", submenu: branchMenuItems },
			{ label: "-" },
			{
				label: "View advanced search syntax",
				key: "view",
				action: () =>
					HostApi.instance.send(OpenUrlRequestType, {
						url: "https://help.codestream.com/FIXME-URL-IN-ReviewsPanel.js"
					})
			}
		];
		// console.log("FILTERS: ", filters);
		return (
			<div className="panel full-height reviews-panel">
				<PanelHeader title="Code Reviews &amp; Issues">
					<SearchBar className="search-bar">
						<FiltersButton items={filterItems}>
							Filters
							<Icon name="chevron-down" />
						</FiltersButton>
						<div className="search-input">
							<Icon name="search" className="search" />
							{this.state.q && (
								<span className="save" onClick={this.saveFilter}>
									<Icon
										name="bookmark"
										className="clickable"
										title="Save custom filter"
										placement="bottomRight"
										align={{ offset: [15, 5] }}
									/>
								</span>
							)}
							<input
								name="q"
								value={this.state.q}
								className="input-text control"
								type="text"
								ref={ref => (this._searchInput = ref)}
								onChange={e => this.setQ(e.target.value)}
								placeholder="Search all code reviews and issues"
							/>
						</div>
					</SearchBar>
					{savedFilters.map((filter, index) => {
						if (index == this.state.editingFilterIndex) return this.renderSaveFilter(index);
						return (
							<SavedFilter onClick={() => this.setQ(filter.q)}>
								<label>
									<Icon name="bookmark" className="bookmark" /> {filter.label}
								</label>
								<Icon
									name="gear"
									className="gear"
									onClick={e =>
										this.setState({ filterMenuOpen: index, filterMenuTarget: e.target })
									}
								/>
								{this.state.filterMenuOpen === index && (
									<Menu
										align="center"
										items={[
											{
												label: "Edit Name",
												key: "edit",
												action: () => this.editSavedFilter(index)
											},
											{
												label: "Delete",
												key: "delete",
												action: () => this.deleteSavedFilter(index)
											}
										]}
										target={this.state.filterMenuTarget}
										action={() => this.setState({ filterMenuOpen: -1 })}
									/>
								)}
							</SavedFilter>
						);
					})}
					{this.state.savingFilter && this.renderSaveFilter()}
				</PanelHeader>
				<ScrollBox>
					<div className="channel-list vscroll" style={{ paddingTop: "10px" }}>
						{totalReviews > 0 &&
							sections.map(section => {
								return this.renderSection(section, displayReviews[section] || []);
							})}
						{!totalReviews && <div className="no-matches">No results match your search.</div>}
						<ProTip />
					</div>
				</ScrollBox>
			</div>
		);
	}

	renderBlankFiller() {
		return (
			<div className="panel reviews-panel">
				<div className="getting-started">
					<div>
						<p>
							Code Reviews are the building blocks of your team’s process.{" "}
							<a href="https://github.com/TeamCodeStream/CodeStream/wiki/Building-a-Knowledge-Base-with-Codemarks">
								Learn more about how to use code review.
							</a>
						</p>
					</div>
				</div>
			</div>
		);
	}

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
	const { context, session, teams, users, preferences } = state;

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

	const reviews = reviewSelectors.getAllReviews(state);
	const usernames = userSelectors.getUsernames(state);
	const usernameMap = userSelectors.getUsernamesByIdLowerCase(state);

	const teamTagsArray = userSelectors.getTeamTagsArray(state);
	let tagFiltersLabelsLower = { all: "with any tag" };
	teamTagsArray.map(tag => {
		// tagFiltersLabelsLower[tag.id] = "with tag: " + (tag.label || tag.color);
		tagFiltersLabelsLower[tag.id] = (
			<span>
				with tag <Tag tag={tag}></Tag>
			</span>
		);
	});

	let branchArray = {};
	let commitArray = {};
	let authorArray = {};
	let repoArray = {};
	reviews.forEach(review => {
		const { markers, createdAt, creatorId, reviewChangesets = [] } = review;
		const author = userSelectors.getUserByCsId(users, creatorId);
		if (author) {
			author.name = author.fullName || author.username || author.email;
			authorArray[creatorId] = author;
		}
		reviewChangesets.forEach(changeset => {
			const { repoId, branch } = changeset;
			if (repoId) repoArray[repoId] = createdAt;
			if (branch) branchArray[branch] = createdAt;
		});
	});

	let savedSearchFilters = [];
	Object.keys(preferences.savedSearchFilters || {}).forEach(key => {
		savedSearchFilters[parseInt(key, 10)] = preferences.savedSearchFilters[key];
	});
	savedSearchFilters = savedSearchFilters.filter(filter => filter.label.length > 0);

	return {
		noReviewsAtAll: !reviewSelectors.teamHasReviews(state),
		usernames,
		usernameMap,
		savedSearchFilters,
		currentUsername: users[session.userId].username,
		reviews,
		team: teams[context.currentTeamId],
		teamMembers: userSelectors.getTeamMembers(state),
		// tagFilter: context.reviewTagFilter,
		authorFilter: "all", // FIXME
		teamTagsArray,
		// tagFiltersLabelsLower,
		authorArray,
		branchArray,
		repoArray,
		// authorFiltersLabelsLower,
		webviewFocused: context.hasFocus
	};
};

export default connect(mapStateToProps, { ...actions })(SimpleReviewsPanel);
