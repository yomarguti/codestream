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
import { includes as _includes, sortBy as _sortBy, last as _last } from "lodash-es";
import Feedback from "./Feedback";
import { CodeStreamState } from "../store";
import { setCodemarkTypeFilter } from "../store/context/actions";
import { getActivity } from "../store/activityFeed/reducer";
import { useDidMount } from "../utilities/hooks";
import { HostApi } from "../webview-api";
import { FetchActivityRequestType, PostPlus } from "@codestream/protocols/agent";
import { savePosts } from "../store/posts/actions";
import { addOlderActivity } from "../store/activityFeed/actions";
import { saveCodemarks } from "../store/codemarks/actions";
import { safe } from "../utils";
import { markStreamRead } from "./actions";
import { CodemarkType } from "@codestream/protocols/api";
import { resetLastReads } from "../store/unreads/actions";

const ActivityWrapper = styled.div<{ unread?: boolean }>`
	margin: 0 40px 20px 45px;
	.codemark.inline {
		${props => (props.unread ? `border-left: 2px solid var(--text-color-info);` : "")}
	}
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

const LoadingMessage = styled.div`
	width: 100%;
	margin: 0 auto;
	text-align: center;
`;

const BATCH_COUNT = 50;

export const ActivityPanel = () => {
	const dispatch = useDispatch();
	const derivedState = useSelector((state: CodeStreamState) => {
		const usernames = userSelectors.getUsernames(state);

		return {
			noCodemarksAtAll: !codemarkSelectors.teamHasCodemarks(state),
			currentUserName: state.users[state.session.userId!].username,
			usernames,
			activity: getActivity(state),
			hasMoreActivity: state.activityFeed.hasMore,
			codemarkTypeFilter: state.context.codemarkTypeFilter,
			umis: state.umis,
			webviewFocused: state.context.hasFocus
		};
	});

	const fetchActivity = React.useCallback(async () => {
		const response = await HostApi.instance.send(FetchActivityRequestType, {
			limit: BATCH_COUNT,
			before: safe(() => _last(derivedState.activity)!.id)
		});
		dispatch(savePosts(response.posts));
		dispatch(saveCodemarks(response.codemarks));
		dispatch(
			addOlderActivity("codemark", {
				activities: response.codemarks,
				hasMore: Boolean(response.more)
			})
		);
	}, [derivedState.activity]);

	useDidMount(() => {
		if (derivedState.activity.length === 0) fetchActivity();
		return () => {
			dispatch(resetLastReads());
		};
	});

	React.useEffect(() => {
		for (let streamId in derivedState.umis.unreads) {
			dispatch(markStreamRead(streamId));
		}
	}, [derivedState.webviewFocused]);

	const intersectionCallback = () => {
		if (!derivedState.hasMoreActivity) return;
		fetchActivity();
	};

	const { targetRef, rootRef } = useIntersectionObserver(intersectionCallback);

	const renderActivity = () => {
		let counter = 0;
		const demoMode = false;
		const dave = { username: "dave", fullName: "David Hersh" };
		const akon = { username: "akonwi", fullName: "Akonwi Ngoh", email: "akonwi@codestream.com" };

		return derivedState.activity.map(codemark => {
			if (codemark.deactivated) return null;
			if (
				derivedState.codemarkTypeFilter != "all" &&
				codemark.type !== derivedState.codemarkTypeFilter
			)
				return null;

			const lastReadForStream = derivedState.umis.lastReads[codemark.streamId];
			const isUnread =
				lastReadForStream != undefined &&
				codemark.post != undefined &&
				(codemark.post as PostPlus).seqNum > lastReadForStream;

			return [
				demoMode && counter == 2 ? (
					<ActivityWrapper key={counter}>
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
					<ActivityWrapper key={counter}>
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
				<ActivityWrapper key={codemark.id} unread={isUnread}>
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

	const showActivityLabels = {
		all: "all activity",
		[CodemarkType.Comment]: "comments",
		[CodemarkType.Issue]: "issues"
	};

	const menuItems = [
		{ label: "All Activity", action: "all" },
		{ label: "-" },
		{ label: "Code Comments", action: CodemarkType.Comment },
		{ label: "Issues", action: CodemarkType.Issue }
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
					selected={derivedState.codemarkTypeFilter}
					labels={showActivityLabels}
					items={menuItems}
				/>
			</div>
			<ScrollBox>
				<div ref={rootRef} className="channel-list vscroll">
					{renderActivity()}
					{derivedState.hasMoreActivity && (
						<LoadingMessage ref={targetRef}>
							<Icon className="spin" name="sync" /> Loading more...
						</LoadingMessage>
					)}
				</div>
			</ScrollBox>
			{/*
			<div className="view-selectors">
				<span className="count">
					Commits<div className="switch"></div>
				</span>
				<span className="count">
					Branches<div className="switch"></div>
				</span>
				<Feedback />
			</div>
			*/}
		</div>
	);
};

function useIntersectionObserver(
	callback: IntersectionObserverCallback,
	options: Pick<IntersectionObserverInit, "threshold" | "rootMargin"> = {}
) {
	const callbackRef = React.useRef(callback);
	React.useEffect(() => {
		callbackRef.current = callback;
	});
	const observerRef = React.useRef<IntersectionObserver>();
	const rootRef = React.useRef<HTMLElement>(null);
	const targetRef = React.useCallback(element => {
		if (element == undefined) {
			// clean up
			if (observerRef.current != undefined) {
				observerRef.current.disconnect();
				observerRef.current = undefined;
			}
			return;
		}

		// can't observe yet
		if (!rootRef.current) return;

		const observer = new IntersectionObserver(
			function(...args: Parameters<IntersectionObserverCallback>) {
				callbackRef.current.call(undefined, ...args);
			},
			{
				...options,
				root: rootRef.current
			}
		);
		observer.observe(element);

		observerRef.current = observer;
	}, []);

	React.useEffect(() => {
		return () => {
			observerRef.current && observerRef.current.disconnect();
		};
	}, []);

	return { targetRef, rootRef: rootRef as any };
}
