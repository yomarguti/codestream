import React from "react";
import { useDispatch, useSelector } from "react-redux";
import Icon from "./Icon";
import ScrollBox from "./ScrollBox";
import Headshot from "./Headshot";
import Filter from "./Filter";
import Timestamp from "./Timestamp";
import Codemark from "./Codemark";
import * as codemarkSelectors from "../store/codemarks/reducer";
import * as userSelectors from "../store/users/reducer";
import styled from "styled-components";
import { includes as _includes, sortBy as _sortBy } from "lodash-es";
import Feedback from "./Feedback";
import { CodeStreamState } from "../store";
import { setCodemarkTypeFilter } from "../store/context/actions";

const ActivityWrapper = styled.div`
	margin: 0 40px 20px 45px;
	// for now this is only to explore the aesthetic... doesn't actually work
	// it should be .post.unread
	.post {
		border-left: 2px solid var(--text-color-info);
	}
	> time,
	> .activity {
		display: block;
		margin-bottom: 20px !important;
		text-align: center;
		.details {
		}
	}
	.emote {
		font-weight: normal;
		padding-left: 4px;
	}
	.codemark-details {
		margin-bottom: 5px;
	}
`;

export const ActivityPanel = () => {
	const dispatch = useDispatch();
	const derivedState = useSelector((state: CodeStreamState) => {
		const codemarks = codemarkSelectors.getTypeFilteredCodemarks(state);
		const usernames = userSelectors.getUsernames(state);

		return {
			noCodemarksAtAll: !codemarkSelectors.teamHasCodemarks(state),
			currentUserName: state.users[state.session.userId!].username,
			usernames,
			codemarks
		};
	});

	const renderActivity = () => {
		const { codemarks } = derivedState;
		let counter = 0;
		const demoMode = false;
		const dave = { username: "dave", fullName: "David Hersh" };
		const akon = { username: "akonwi", fullName: "Akonwi Ngoh", email: "akonwi@codestream.com" };

		return _sortBy(codemarks, codemark => -codemark.createdAt).map(codemark => {
			const codemarkType = codemark.type || "comment";
			if (codemark.deactivated) return null;
			// FIXME TODO load the next 10 when you scroll
			if (counter++ > 10) return null;

			return [
				demoMode && counter == 2 ? (
					<ActivityWrapper>
						<div className="codemark inline">
							<div className="contents">
								<div className="body">
									<div className="header" style={{ margin: 0 }}>
										<div className="author">
											<Headshot person={dave} />
											dave <span className="emote">joined CodeStream</span>
											<Timestamp time={codemark.createdAt} />
										</div>
									</div>
								</div>
							</div>
						</div>
					</ActivityWrapper>
				) : null,
				demoMode && counter == 3 ? (
					<ActivityWrapper>
						<div className="codemark inline">
							<div className="contents">
								<div className="body">
									<div className="header">
										<div className="author">
											<Headshot person={akon} />
											akon <span className="emote"> created </span> &nbsp;{" "}
											<Icon name="git-branch" />
											<span className="monospace" style={{ paddingLeft: "5px" }}>
												feature/sharing
											</span>
											<Timestamp time={codemark.createdAt} />
										</div>
									</div>
									<div className="right" style={{ margin: "10px 0 0 0" }}>
										<div className="codemark-actions-button">Checkout</div>
										<div className="codemark-actions-button">Open on GitHub</div>
									</div>
								</div>
							</div>
						</div>
					</ActivityWrapper>
				) : null,
				<ActivityWrapper>
					{/* <Timestamp dateOnly={true} time={codemark.createdAt} /> */}
					{demoMode && counter == 5 && <Timestamp dateOnly={true} time={codemark.createdAt} />}
					<Codemark
						key={codemark.id}
						contextName="Activity Panel"
						codemark={codemark}
						displayType="activity"
						currentUserName={derivedState.currentUserName}
						usernames={derivedState.usernames}
						selected={false}
					/>
				</ActivityWrapper>
			];
		});
	};

	const showActivity = "all";
	const showActivityLabels = {
		all: "all activity"
	};
	const menuItems = [
		{ label: "All Activity", action: "all" },
		{ label: "-" },
		{ label: "Code Comments", action: "comment" },
		// { label: "Questions & Answers", action: "question" },
		{ label: "Issues", action: "issue" }
	];
	return (
		<div className="panel full-height activity-panel">
			<div className="panel-header" style={{ textAlign: "left", padding: "15px 30px 5px 45px" }}>
				Activity
			</div>
			<div className="filters" style={{ textAlign: "left", padding: "0px 30px 15px 45px" }}>
				Show{" "}
				<Filter
					onValue={value => dispatch(setCodemarkTypeFilter(value))}
					selected={showActivity}
					labels={showActivityLabels}
					items={menuItems}
				/>
			</div>
			<ScrollBox>
				<div className="channel-list vscroll">{renderActivity()}</div>
			</ScrollBox>
			<div className="view-selectors">
				<span className="count">
					Commits<div className="switch"></div>
				</span>
				<span className="count">
					Branches<div className="switch"></div>
				</span>
				<Feedback />
			</div>
		</div>
	);
};
