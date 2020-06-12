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

const PersonWrapper = styled.div`
	margin: 0 40px 20px 45px;
	// for now this is only to explore the aesthetic... doesn't actually work
	// it should be .post.unread
	.post {
		border-left: 2px solid var(--text-color-info);
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

export const TasksPanel = (connect(
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
				<PersonWrapper>
					<Codemark
						key={codemark.id}
						contextName="Activity Panel"
						codemark={codemark}
						displayType="activity"
						currentUserName={props.currentUserName}
						usernames={props.usernames}
					/>
				</PersonWrapper>
			);
		});
	};

	const showActivity = "open";
	const showActivityLabels = {
		open: "open tasks"
	};
	const menuItems = [
		{ label: "Open Tasks", action: "open" },
		{ label: "Closed Tasks", action: "closed" },
		// { label: "Questions & Answers", action: "question" },
		{ label: "All Tasks", action: "all" }
	];

	return (
		<div className="panel full-height activity-panel">
			<div className="panel-header" style={{ textAlign: "left", padding: "15px 30px 5px 45px" }}>
				Your Tasks
			</div>
			<div className="filters" style={{ textAlign: "left", padding: "0px 30px 15px 45px" }}>
				Show{" "}
				<Filter
					onValue={props.setChannelFilter}
					selected={showActivity}
					labels={showActivityLabels}
					items={menuItems}
				/>
			</div>
			<ScrollBox>
				<div className="channel-list vscroll">{renderActivity()}</div>
			</ScrollBox>
		</div>
	);
});
