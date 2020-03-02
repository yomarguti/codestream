import React from "react";
import { ReviewPlus } from "@codestream/protocols/agent";
import { HostApi } from "../..";
import { ReviewShowDiffRequestType } from "@codestream/protocols/webview";
import { ChangesetFile } from "./ChangesetFile";
import { useSelector, useDispatch } from "react-redux";
import { CodeStreamState } from "@codestream/webview/store";
import { showDiff } from "@codestream/webview/store/reviews/actions";
import { Dispatch } from "../../store/common";
import Icon from "../Icon";

export const ChangesetFileList = (props: { review: ReviewPlus; noOnClick?: boolean }) => {
	const { review, noOnClick } = props;
	const dispatch = useDispatch<Dispatch>();
	const derivedState = useSelector((state: CodeStreamState) => {
		const userId = state.session.userId || "";
		if (
			state.context.currentReviewId &&
			state.editorContext.scmInfo &&
			state.editorContext.scmInfo.uri &&
			state.editorContext.scmInfo.uri.startsWith("codestream-diff://")
		) {
			return { matchFile: state.editorContext.scmInfo.uri, userId };
		} else return { matchFile: "", userId };
	});

	const changedFiles = React.useMemo(() => {
		const files: any[] = [];
		for (let changeset of review.reviewChangesets) {
			files.push(
				...changeset.modifiedFiles.map(f => {
					const selected = (derivedState.matchFile || "").endsWith(f.file);
					const visited = f.reviewStatus && f.reviewStatus[derivedState.userId] === "visited";
					const icon = selected ? "arrow-right" : visited ? "heart" : "heart";
					return (
						<ChangesetFile
							selected={selected}
							noHover={noOnClick}
							icon={<Icon name={icon} className="file-icon" />}
							onClick={e => {
								if (noOnClick) return;
								e.preventDefault();
								dispatch(showDiff(review.id, changeset.repoId, f.file));
							}}
							key={f.file}
							{...f}
						/>
					);
				})
			);
		}
		return files;
	}, [review, noOnClick, derivedState.matchFile]);

	return <>{changedFiles}</>;
};
