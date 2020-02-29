import React from "react";
import { ReviewPlus } from "@codestream/protocols/agent";
import { HostApi } from "../..";
import { ReviewShowDiffRequestType } from "@codestream/protocols/webview";
import { ChangesetFile } from "./ChangesetFile";
import { useSelector } from "react-redux";
import { CodeStreamState } from "@codestream/webview/store";

export const ChangesetFileList = (props: { review: ReviewPlus; noOnClick?: boolean }) => {
	const { review, noOnClick } = props;
	const derivedState = useSelector((state: CodeStreamState) => {
		if (
			state.context.activeReviewId &&
			state.editorContext.scmInfo &&
			state.editorContext.scmInfo.uri &&
			state.editorContext.scmInfo.uri.startsWith("codestream-diff://")
		) {
			return { matchFile: state.editorContext.activeFile };
		} else return { matchFile: "" };
	});

	const changedFiles = React.useMemo(() => {
		const files: any[] = [];
		for (let changeset of review.reviewChangesets) {
			files.push(
				...changeset.modifiedFiles.map(f => {
					return (
						<ChangesetFile
							selected={(derivedState.matchFile || "").endsWith(f.file)}
							onClick={e => {
								if (noOnClick) return;
								e.preventDefault();
								HostApi.instance.send(ReviewShowDiffRequestType, {
									reviewId: review.id,
									repoId: changeset.repoId,
									path: f.file
								});
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
