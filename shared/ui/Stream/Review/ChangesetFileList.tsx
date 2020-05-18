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
import { useDidMount } from "@codestream/webview/utilities/hooks";
import {
	ShowNextChangedFileRequestType,
	ShowNextChangedFileNotificationType,
	ShowPreviousChangedFileNotificationType
} from "@codestream/protocols/webview";

const VISITED_REVIEW_FILES = "review:changeset-file-list";
const NOW = new Date().getTime(); // a rough timestamp so we know when the file was visited
const visitedFiles = localStore.get(VISITED_REVIEW_FILES) || {};

export const ChangesetFileList = (props: {
	review: ReviewPlus;
	loading?: boolean;
	noOnClick?: boolean;
	showRepoLabels?: boolean;
	checkpoint?: number;
}) => {
	const { review, noOnClick, loading, checkpoint } = props;
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

		let index = 0;
		let indexToChangesetMap = {};
		let indexToFileMap = {};

		let changesets;
		if (checkpoint !== undefined) {
			changesets = review.reviewChangesets.filter(rc => rc.checkpoint === checkpoint);
		} else {
			changesets = [review.reviewChangesets[review.reviewChangesets.length - 1]];
		}

		for (let changeset of changesets) {
			const modifiedFiles =
				checkpoint !== undefined ? changeset.modifiedFilesInCheckpoint : changeset.modifiedFiles;
			modifiedFiles.forEach(f => {
				indexToChangesetMap[index] = changeset;
				indexToFileMap[index] = f;
				index++;
			});
		}
		// for (const modifiedFile of modifiedFiles) {
		// 	indexToChangesetMap[index] = changeset;
		// 	indexToFileMap[index] = modifiedFile;
		// 	index++;
		// }

		return {
			matchFile,
			userId,
			repos: state.repos,
			numFiles: index,
			indexToChangesetMap,
			indexToFileMap,
			changesets
		};
	});

	useDidMount(() => {
		const disposables = [
			HostApi.instance.on(ShowNextChangedFileNotificationType, nextFile),
			HostApi.instance.on(ShowPreviousChangedFileNotificationType, prevFile)
		];

		return () => disposables.forEach(disposable => disposable.dispose());
	});

	const goFile = async index => {
		if (index < 0) index = derivedState.numFiles - 1;
		if (index > derivedState.numFiles - 1) index = 0;
		const f = derivedState.indexToFileMap[index];
		const changeset = derivedState.indexToChangesetMap[index];
		const visitedKey = [changeset.repoId, f.file].join(":");
		await dispatch(showDiff(review.id, checkpoint, changeset.repoId, f.file));
		visitedFiles[review.id + ":" + checkpoint][visitedKey] = NOW;
		visitedFiles[review.id + ":" + checkpoint]._latest = index;
		localStore.set(VISITED_REVIEW_FILES, visitedFiles);
	};

	const nextFile = () => {
		if (!visitedFiles[review.id + ":" + checkpoint]) goFile(0);
		else if (visitedFiles[review.id + ":" + checkpoint]._latest == null) goFile(0);
		else goFile(visitedFiles[review.id + ":" + checkpoint]._latest + 1);
	};

	const prevFile = () => {
		if (!visitedFiles[review.id + ":" + checkpoint]) goFile(-1);
		else if (visitedFiles[review.id + ":" + checkpoint]._latest == null) goFile(-1);
		else goFile(visitedFiles[review.id + ":" + checkpoint]._latest - 1);
	};

	const latest = visitedFiles[review.id + ":" + checkpoint]
		? visitedFiles[review.id + ":" + checkpoint]._latest
		: 0;

	const changedFiles = React.useMemo(() => {
		const files: any[] = [];

		const reviewKey = review.id + ":" + checkpoint;
		let index = 0;
		for (let changeset of derivedState.changesets) {
			if (props.showRepoLabels) {
				const repoName = safe(() => getById(derivedState.repos, changeset!.repoId).name) || "";
				if (repoName) {
					files.push(
						<div style={{ marginBottom: "5px" }}>
							<Icon name="repo" /> {repoName} &nbsp; <Icon name="git-branch" /> {changeset!.branch}
						</div>
					);
				}
			}
			const visitedFilesInReview = visitedFiles[reviewKey] || (visitedFiles[reviewKey] = {});
			const modifiedFiles =
				checkpoint !== undefined ? changeset.modifiedFilesInCheckpoint : changeset.modifiedFiles;
			files.push(
				...modifiedFiles.map(f => {
					const visitedKey = [changeset!.repoId, f.file].join(":");
					const cp = checkpoint !== undefined ? checkpoint : "all";
					const uri = `codestream-diff://${review.id}/${cp}/${changeset!.repoId}/right/${f.file}`;
					const selected = (derivedState.matchFile || "") == uri;
					const visited = visitedFilesInReview[visitedKey];
					if (selected && !visited) {
						visitedFilesInReview[visitedKey] = NOW;
						visitedFilesInReview._latest = index;
						localStore.set(VISITED_REVIEW_FILES, visitedFiles);
					}

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
					// i is a temp variable to create the correct scope binding
					const i = index++;
					return (
						<ChangesetFile
							selected={selected}
							noHover={noOnClick}
							icon={icon && <Icon name={icon} className={iconClass} />}
							onClick={async e => {
								if (noOnClick) return;
								e.preventDefault();
								goFile(i);
							}}
							key={changeset!.checkpoint + ":" + i + ":" + f.file}
							{...f}
						/>
					);
				})
			);
		}
		return files;
	}, [review, loading, noOnClick, derivedState.matchFile, latest, checkpoint]);

	return <>{changedFiles}</>;
};
