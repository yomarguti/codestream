import cx from "classnames";
import { Range } from "vscode-languageserver-types";
import React, { useState } from "react";
import { connect } from "react-redux";
import { useSelector, useDispatch } from "react-redux";
import Icon from "./Icon";
import ScrollBox from "./ScrollBox";
import Tag from "./Tag";
import Filter from "./Filter";
import Headshot from "./Headshot";
import Codemark from "./Codemark";
import { CSMarker, CSCodemark } from "@codestream/protocols/api";
import * as actions from "./actions";
import { setCurrentStream, setCurrentCodemark } from "../store/context/actions";
import * as codemarkSelectors from "../store/codemarks/reducer";
import * as userSelectors from "../store/users/reducer";
import styled from "styled-components";
import { includes as _includes, sortBy as _sortBy } from "lodash-es";

interface Props {
	codemarks: CSCodemark[];
	setChannelFilter: Function;
	usernames: string[];
	currentUserName: string;
}

const ActivityWrapper = styled.div`
	margin: 0 40px 20px 45px;
	&.new {
		border-left: 4px solid var(--text-color-info);
	}
`;

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

	const codemarks = codemarkSelectors.getTypeFilteredCodemarks(state);
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
	codemarks.forEach(codemark => {
		const { markers, createdAt, creatorId } = codemark;
		const author = userSelectors.getUserByCsId(users, creatorId) || ({} as any);
		author.name = author.fullName || author.username || author.email;
		authorArray[creatorId] = author;
		authorFiltersLabelsLower[creatorId] = (
			<span className="headshot-wrapper">
				by &nbsp;
				<Headshot size={18} person={author} />
				{author.name}
			</span>
		);
		if (markers) {
			markers.forEach(marker => {
				const { branchWhenCreated: branch, commitHashWhenCreated: commit } = marker;
				if (branch) {
					// keep track of the most recent comment on the branch
					branchArray[branch] = Math.max(createdAt, branchArray[branch]);
					branchFiltersLabelsLower[branch] = (
						<span>
							on &nbsp;
							<Icon name="git-branch" />
							&nbsp;{branch}
						</span>
					);
				}
				if (commit) {
					// keep track of the most recent comment on the commit
					commitArray[commit] = Math.max(createdAt, commitArray[commit]);
					branchFiltersLabelsLower[commit] = (
						<span>
							on &nbsp;
							<Icon name="git-commit" />
							&nbsp;{commit.substr(0, 8)}
						</span>
					);
				}
			});
		}
	});

	return {
		noCodemarksAtAll: !codemarkSelectors.teamHasCodemarks(state),
		usernames,
		codemarks,
		team: teams[context.currentTeamId],
		// fileFilter: context.codemarkFileFilter,
		// typeFilter: context.codemarkTypeFilter,
		// tagFilter: context.codemarkTagFilter,
		// authorFilter: context.codemarkAuthorFilter,
		// branchFilter: context.codemarkBranchFilter,
		// fileNameToFilterFor,
		// fileStreamIdToFilterFor,
		teamTagsArray,
		tagFiltersLabelsLower,
		branchArray,
		commitArray,
		authorArray,
		branchFiltersLabelsLower,
		authorFiltersLabelsLower
	};
};

export const ActivityPanel = (connect(
	mapStateToProps,
	{ ...actions, setCurrentStream, setCurrentCodemark }
) as any)((props: Props) => {
	const dispatch = useDispatch();
	const [loading, setLoading] = useState(false);
	const [showActivity, setShowActivity] = useState();

	const renderActivity = () => {
		const { codemarks } = props;
		let counter = 0;
		return _sortBy(codemarks, codemark => -codemark.createdAt).map(codemark => {
			const codemarkType = codemark.type || "comment";
			if (codemark.deactivated) return null;
			if (counter++ > 10) return null;
			// if (typeFilter !== "all" && codemarkType !== typeFilter) return null;
			// if (authorFilter !== "all" && codemark.creatorId !== authorFilter) return null;
			// if (!this.codemarkHasTag(codemark, tagFilter)) return null;
			// if (!this.codemarkOnBranch(codemark, branchFilter)) return null;

			return (
				<ActivityWrapper>
					<Codemark
						key={codemark.id}
						contextName="Activity Panel"
						codemark={codemark}
						selected={true}
						displayType="activity"
						currentUserName={props.currentUserName}
						usernames={props.usernames}
					/>
				</ActivityWrapper>
			);
		});
	};

	const showChannelsLabel = {
		all: "all conversations",
		"unreads-starred": "unread & starred conversations",
		unreads: "unread conversations",
		selected: "selected conversations"
	};
	const menuItems = [
		{ label: "All Conversations", action: "all" },
		{ label: "Unread & Starred Conversations", action: "unreads-starred" },
		{ label: "Unread Conversations", action: "unreads" },
		{ label: "-" },
		{ label: "Selected Conversations", action: "selecting" }
	];

	return (
		<div className="panel activity-panel">
			<div className="panel-header">Activity</div>
			{
				// <div className="filters">
				// 	Show{" "}
				// 	<Filter
				// 		onValue={props.setChannelFilter}
				// 		selected={showActivity}
				// 		labels={showChannelsLabel}
				// 		items={menuItems}
				// 	/>
				// </div>
			}
			<ScrollBox>
				<div className="channel-list vscroll">{renderActivity()}</div>
			</ScrollBox>
		</div>
	);
});
