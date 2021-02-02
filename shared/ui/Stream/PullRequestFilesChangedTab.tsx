import React, { useState, useEffect } from "react";
import { useDidMount } from "../utilities/hooks";
import { useSelector, useDispatch } from "react-redux";
import { CodeStreamState } from "../store";
import { FileStatus } from "@codestream/protocols/api";
import { LoadingMessage } from "../src/components/LoadingMessage";
import { getPullRequestFiles } from "../store/providerPullRequests/actions";
import { PullRequestFilesChangedList } from "./PullRequestFilesChangedList";
import { FetchThirdPartyPullRequestPullRequest } from "@codestream/protocols/agent";
import { getCurrentProviderPullRequest } from "../store/providerPullRequests/reducer";

const STATUS_MAP = {
	modified: FileStatus.modified
};

export const PullRequestFilesChangedTab = (props: {
	//pr: FetchThirdPartyPullRequestPullRequest;
	fetch: Function;
	setIsLoadingMessage: Function;
}) => {
	//const { pr } = props;
	const dispatch = useDispatch();
	const derivedState = useSelector((state: CodeStreamState) => {
		return {
			currentPullRequest: getCurrentProviderPullRequest(state),
			providerPullRequests: state.providerPullRequests.pullRequests,
			pullRequestFilesChangedMode: state.preferences.pullRequestFilesChangedMode || "files",
			currentPullRequestId: state.context.currentPullRequest
				? state.context.currentPullRequest.id
				: undefined,
			currentPullRequestProviderId: state.context.currentPullRequest
				? state.context.currentPullRequest.providerId
				: undefined
		};
	});

	const [isLoading, setIsLoading] = useState(true);
	const [filesChanged, setFilesChanged] = useState<any[]>([]);

	const _mapData = data => {
		const filesChanged = data.map(_ => {
			return {
				..._,
				linesAdded: _.additions,
				linesRemoved: _.deletions,
				file: _.filename,
				sha: _.sha,
				status: STATUS_MAP[_.status]
			};
		});
		filesChanged.sort((a, b) => a.file.localeCompare(b.file));
		setFilesChanged(filesChanged);
		setIsLoading(false);
	};

	useEffect(() => {
		if (!derivedState.currentPullRequestProviderId) return;
		// re-render if providerPullRequests changes
		(async () => {
			const data = await dispatch(
				getPullRequestFiles(
					derivedState.currentPullRequestProviderId!,
					derivedState.currentPullRequestId!
				)
			);
			_mapData(data);
		})();
	}, [derivedState.currentPullRequestProviderId, derivedState.providerPullRequests]);

	useDidMount(() => {
		if (!derivedState.currentPullRequestProviderId) return;

		setIsLoading(true);
		(async () => {
			const data = await dispatch(
				getPullRequestFiles(
					derivedState.currentPullRequestProviderId!,
					derivedState.currentPullRequestId!
				)
			);
			_mapData(data);
		})();
	});

	if (isLoading)
		return (
			<div style={{ marginTop: "100px" }}>
				<LoadingMessage>Loading Changed Files...</LoadingMessage>
			</div>
		);

	if (
		!derivedState.currentPullRequest ||
		!derivedState.currentPullRequest.conversations ||
		!derivedState.currentPullRequest.conversations.repository ||
		!derivedState.currentPullRequest.conversations.repository.pullRequest
	)
		return null;
	if (!filesChanged || !filesChanged.length) return null;
	const pr = derivedState.currentPullRequest.conversations.repository.pullRequest;
	return (
		<div style={{ position: "relative", margin: "0 0 20px 20px" }}>
			<PullRequestFilesChangedList
				pr={pr}
				filesChanged={filesChanged}
				repositoryName={pr.repository.name}
				baseRef={pr.baseRefOid}
				baseRefName={pr.baseRefName}
				headRef={pr.headRefOid}
				headRefName={pr.headRefName}
				isLoading={isLoading}
				fetch={props.fetch!}
				setIsLoadingMessage={props.setIsLoadingMessage!}
			/>
		</div>
	);
};
