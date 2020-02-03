import React, { Component } from "react";
import { connect } from "react-redux";
import createClassString from "classnames";
import * as actions from "./actions";
import * as reviewSelectors from "../store/reviews/reducer";
import * as userSelectors from "../store/users/reducer";
import Tag from "./Tag";
import Icon from "./Icon";
import ScrollBox from "./ScrollBox";
import Filter from "./Filter";
import Review from "./Review";
import { ProTip } from "./ProTip";
import Headshot from "./Headshot";
import { HostApi } from "../webview-api";
import { includes as _includes, sortBy as _sortBy } from "lodash-es";
import { PanelHeader } from "../src/components/PanelHeader";
import styled from "styled-components";
import { Button } from "../src/components/Button";

const SearchBar = styled.div`
	display: flex;
	flex-direction: row;
	input.control {
		padding-left: 32px !important;
		height: 100%;
	}
	.search-input {
		position: relative;
		flex-grow: 10;
		width: 100%;
		.icon {
			position: absolute;
			left: 0px;
			top: 6px;
			opacity: 0.5;
		}
	}
`;

const FiltersButton = styled(Button)`
	flex-grow: 0;
	white-space: nowrap;
`;

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
			selectedTags: {}
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

	renderPosts = reviews => {
		const { typeFilter } = this.props;
		if (reviews.length === 0)
			return <div className="no-matches">No {typeFilter}s in this file.</div>;
		else {
			return reviews.map(review => {
				return (
					<div style={{ padding: "5px 20px" }}>
						<Icon name="checked-checkbox" /> {review.title}
						{/*	FIXME <Review key={review.id} review={review} query={this.state.q} />*/}
					</div>
				);
			});
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
				<ul>{this.renderPosts(reviews)}</ul>
			</div>
		);
	};

	hasTag = (review, tagFilter) => {
		if (tagFilter === "all") return true;
		let tags = review.tags || [];
		return tags.includes(tagFilter);
	};

	onBranch = (review, branchFilter) => {
		if (reviewFilter === "all") return true;

		return review.branch === branchFilter;
	};

	render() {
		// if (this.state.isLoading) return null;

		if (false && this.props.noReviewsAtAll) {
			return this.renderBlankFiller();
		}

		const {
			reviews,
			currentUserId,
			tagFilter,
			authorFilter,
			branchFilter,
			commitArray,
			branchArray,
			authorArray
		} = this.props;
		const { thisRepo } = this.state;

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
			if (review.deactivated) return null;
			if (authorFilter !== "all" && review.creatorId !== authorFilter) return null;
			// if (!this.hasTag(review, tagFilter)) return null;
			// if (!this.onBranch(review, branchFilter)) return null;

			const title = review.title;
			const reviewers = review.reviewers;
			const status = review.status;
			const q = this.state.q ? this.state.q.toLocaleLowerCase() : null;

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

		// let tagMenuItems = [{ label: "Any Tag", action: "all" }, { label: "-" }];
		// tagMenuItems = tagMenuItems.concat(
		// 	this.props.teamTagsArray.map(tag => {
		// 		let className = "tag-menu-block wide";
		// 		if (!tag.color.startsWith("#")) className += " " + tag.color + "-background";
		// 		return {
		// 			label: (
		// 				<span className="tag-menu-selector">
		// 					<span
		// 						className={className}
		// 						style={tag.color.startsWith("#") ? { background: tag.color } : {}}
		// 					>
		// 						{tag.label || <span>&nbsp;</span>}
		// 					</span>
		// 				</span>
		// 			),
		// 			noHover: true,
		// 			searchLabel: tag.label || tag.color,
		// 			action: tag.id
		// 		};
		// 	})
		// );

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

		// console.log("SELECTED AG FILTER: ", tagFilter);
		return (
			<div className="panel full-height reviews-panel">
				<PanelHeader title="Code Reviews">
					<SearchBar className="search-bar">
						<FiltersButton>
							Filters
							<Icon name="chevron-down" />
						</FiltersButton>
						<div className="search-input">
							<Icon name="search" />
							<input
								name="q"
								className="input-text control"
								type="text"
								ref={ref => (this._searchInput = ref)}
								onChange={e => this.setState({ q: e.target.value })}
								placeholder="Search Code Reviews"
							/>
						</div>
					</SearchBar>
					{/*
					<div className="filters">
						Show{" "}
						<Filter
							onValue={this.props.setReviewAuthorFilter}
							selected={authorFilter}
							labels={this.props.authorFiltersLabelsLower}
							items={authorMenuItems}
						/>
						<Filter
							onValue={this.props.setReviewTagFilter}
							selected={tagFilter}
							labels={this.props.tagFiltersLabelsLower}
							items={tagMenuItems}
						/>
					</div>
				*/}
				</PanelHeader>
				<ScrollBox>
					<div className="channel-list vscroll" style={{ paddingTop: "10px" }}>
						{totalReviews > 0 &&
							sections.map(section => {
								return this.renderSection(section, displayReviews[section] || []);
							})}
						{!totalReviews && <div className="no-matches">No reviews match this type.</div>}
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
	const { context, teams, users } = state;

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
	const usernameMap = userSelectors.getUsernamesById(state);

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

	let branchFiltersLabelsLower = { all: "on any branch" };
	let authorFiltersLabelsLower = { all: "by anyone" };
	let branchArray = {};
	let commitArray = {};
	let authorArray = {};
	reviews.forEach(review => {
		const { markers, createdAt, creatorId } = review;
		const author = userSelectors.getUserByCsId(users, creatorId);
		if (author) {
			author.name = author.fullName || author.username || author.email;
			authorArray[creatorId] = author;
			authorFiltersLabelsLower[creatorId] = (
				<span className="headshot-wrapper">
					by &nbsp;
					<Headshot size={18} person={author} />
					{author.name}
				</span>
			);
		}
		// markers.forEach(marker => {
		// 	const { branchWhenCreated: branch, commitHashWhenCreated: commit } = marker;
		// 	if (branch) {
		// 		// keep track of the most recent comment on the branch
		// 		branchArray[branch] = Math.max(createdAt, branchArray[branch]);
		// 		branchFiltersLabelsLower[branch] = (
		// 			<span>
		// 				on &nbsp;
		// 				<Icon name="git-branch" />
		// 				&nbsp;{branch}
		// 			</span>
		// 		);
		// 	}
		// 	if (commit) {
		// 		// keep track of the most recent comment on the commit
		// 		commitArray[commit] = Math.max(createdAt, commitArray[commit]);
		// 		branchFiltersLabelsLower[commit] = (
		// 			<span>
		// 				on &nbsp;
		// 				<Icon name="git-commit" />
		// 				&nbsp;{commit.substr(0, 8)}
		// 			</span>
		// 		);
		// 	}
		// });
	});

	return {
		noReviewsAtAll: !reviewSelectors.teamHasReviews(state),
		usernames,
		reviews,
		team: teams[context.currentTeamId],
		// tagFilter: context.reviewTagFilter,
		authorFilter: "all", // FIXME
		teamTagsArray,
		// tagFiltersLabelsLower,
		authorArray,
		// authorFiltersLabelsLower,
		webviewFocused: context.hasFocus
	};
};

export default connect(mapStateToProps, { ...actions })(SimpleReviewsPanel);
