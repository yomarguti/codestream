import React, { useState } from "react";
import { ReviewPlus } from "@codestream/protocols/agent";
import { HostApi } from "../..";
import { localStore } from "../../utilities/storage";
import { ChangesetFile } from "./ChangesetFile";
import { useSelector, useDispatch } from "react-redux";
import { CodeStreamState } from "@codestream/webview/store";
import { showDiff } from "@codestream/webview/store/reviews/actions";
import { Dispatch } from "../../store/common";
import Icon from "../Icon";
import { safe } from "@codestream/webview/utils";
import { getById } from "@codestream/webview/store/repos/reducer";

const VISITED_REVIEW_FILES = "review:changeset-file-list";
const NOW = new Date().getTime(); // a rough timestamp so we know when the file was visited

export const ChangesetFileList = (props: {
	review: ReviewPlus;
	loading?: boolean;
	noOnClick?: boolean;
	showRepoLabels?: boolean;
}) => {
	const { review, noOnClick, loading } = props;
	const dispatch = useDispatch<Dispatch>();
	const derivedState = useSelector((state: CodeStreamState) => {
		const userId = state.session.userId || "";
		const matchFile =
			state.context.currentReviewId &&
			state.editorContext.scmInfo &&
			state.editorContext.scmInfo.uri &&
			state.editorContext.scmInfo.uri.startsWith("codestream-diff://")
				? state.editorContext.scmInfo.uri
				: "";

		return { matchFile, userId, repos: state.repos };
	});

	const visitedFiles = localStore.get(VISITED_REVIEW_FILES) || {};

	const changedFiles = React.useMemo(() => {
		const files: any[] = [];
		for (let changeset of review.reviewChangesets) {
			if (props.showRepoLabels) {
				const repoName = safe(() => getById(derivedState.repos, changeset.repoId).name) || "";
				if (repoName) {
					files.push(
						<div style={{ marginBottom: "5px" }}>
							<Icon name="repo" /> {repoName} &nbsp; <Icon name="git-branch" /> {changeset.branch}
						</div>
					);
				}
			}
			if (!visitedFiles[review.id]) visitedFiles[review.id] = {};
			files.push(
				...changeset.modifiedFiles.map(f => {
					const visitedKey = [changeset.repoId, f.file].join(":");
					const selected = (derivedState.matchFile || "").endsWith(f.file);
					const visited = visitedFiles[review.id][visitedKey];

					let icon;
					// if we're loading, show a spinner
					if (loading) icon = "sync";
					// noOnClick means no icon indicators and no click handler
					else if (noOnClick) icon = null;
					// this file is currently selected, and visible in diff view
					else if (selected) icon = "arrow-right";
					// this file has been visitied during the review
					else if (visited) icon = "ok";
					// not yet visited, but part of the review
					else icon = "circle";

					const iconClass = loading ? "file-icon spin" : "file-icon";
					return (
						<ChangesetFile
							selected={selected}
							noHover={noOnClick}
							icon={icon && <Icon name={icon} className={iconClass} />}
							onClick={async e => {
								if (noOnClick) return;
								e.preventDefault();
								await dispatch(showDiff(review.id, changeset.repoId, f.file));
								visitedFiles[review.id][visitedKey] = NOW;
								localStore.set(VISITED_REVIEW_FILES, visitedFiles);
							}}
							key={f.file}
							{...f}
						/>
					);
				})
			);
		}
		return files;
	}, [review, loading, noOnClick, derivedState.matchFile]);

	return <>{changedFiles}</>;
};
