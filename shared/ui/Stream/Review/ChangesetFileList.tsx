import React from "react";
import { ReviewPlus } from "@codestream/protocols/agent";
import { HostApi } from "../..";
import { ReviewShowDiffRequestType } from "@codestream/protocols/webview";
import { ChangesetFile } from "./ChangesetFile";

export const ChangesetFileList = (props: { review: ReviewPlus }) => {
	const { review } = props;

	const changedFiles = React.useMemo(() => {
		const files: any[] = [];
		for (let changeset of review.reviewChangesets) {
			files.push(
				...changeset.modifiedFiles.map(f => (
					<ChangesetFile
						onClick={e => {
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
				))
			);
		}
		return files;
	}, [review]);

	return <>{changedFiles}</>;
};
