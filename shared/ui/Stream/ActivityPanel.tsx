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
	overflow: visible;
	.unread:before {
		content: "";
		position: absolute;
		top: 0;
		left: -10px;
		height: 100%;
		border-left: 3px solid var(--text-color-info);
	}
`;

const mapStateToProps = state => {
	const { context, teams, users } = state;

	const codemarks = codemarkSelectors.getTypeFilteredCodemarks(state);
	const usernames = userSelectors.getUsernames(state);

	return {
		noCodemarksAtAll: !codemarkSelectors.teamHasCodemarks(state),
		usernames,
		codemarks
	};
};

export const ActivityPanel = (connect(
	mapStateToProps,
	{ ...actions, setCurrentStream, setCurrentCodemark }
) as any)((props: Props) => {
	const renderActivity = () => {
		const { codemarks } = props;
		let counter = 0;
		return _sortBy(codemarks, codemark => -codemark.createdAt).map(codemark => {
			const codemarkType = codemark.type || "comment";
			if (codemark.deactivated) return null;
			// FIXME TODO load the next 10 when you scroll
			if (counter++ > 10) return null;

			return (
				<ActivityWrapper className={Math.random() < 0.5 ? "new" : ""}>
					<Codemark
						key={codemark.id}
						contextName="Activity Panel"
						codemark={codemark}
						displayType="activity"
						currentUserName={props.currentUserName}
						usernames={props.usernames}
					/>
				</ActivityWrapper>
			);
		});
	};

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
