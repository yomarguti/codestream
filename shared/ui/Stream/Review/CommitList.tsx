import React, { useState } from "react";
import { ReviewPlus } from "@codestream/protocols/agent";
import { HostApi } from "../..";
import { ReviewShowDiffRequestType } from "@codestream/protocols/webview";
import { ChangesetFile } from "./ChangesetFile";
import { useSelector, useDispatch } from "react-redux";
import { CodeStreamState } from "@codestream/webview/store";
import { showDiff } from "@codestream/webview/store/reviews/actions";
import { Dispatch } from "../../store/common";
import Icon from "../Icon";
import { safe } from "@codestream/webview/utils";
import { getById } from "@codestream/webview/store/repos/reducer";
import { markdownify } from "../Markdowner";

export const CommitList = (props: { review: ReviewPlus }) => {
	const { review } = props;

	const changesetLines = React.useMemo(() => {
		const lines: any[] = [];
		for (let changeset of review.reviewChangesets) {
			if (changeset.includeSaved || changeset.includeStaged) {
				lines.push(
					<div
						className={`row-with-icon-actions no-hover`}
						style={{ display: "flex", alignItems: "center" }}
						key={"saved-staged"}
					>
						<label className="ellipsis-right-container no-margin">
							<Icon name="save" />
							<span style={{ paddingLeft: "5px" }}>
								This review contains uncommitted local changes
							</span>
						</label>
					</div>
				);
			}
			lines.push(
				...changeset.commits.map(commit => {
					// const selected = (derivedState.matchFile || "").endsWith(f.file);
					// const visited = f.reviewStatus && f.reviewStatus[derivedState.userId] === "visited";
					// const icon = noOnClick ? null : selected ? "arrow-right" : visited ? "ok" : "circle";
					return (
						<div
							className={`row-with-icon-actions no-hover`}
							style={{ display: "flex", alignItems: "center" }}
							key={commit.sha}
						>
							<label className="ellipsis-right-container no-margin" style={{ paddingLeft: "1px" }}>
								<Icon name="git-commit-vertical" />
								{commit.info && (
									<span
										style={{ paddingLeft: "4px" }}
										dangerouslySetInnerHTML={{
											// @ts-ignore
											__html: markdownify(commit.info.shortMessage)
										}}
									/>
								)}
							</label>
							<span
								className="message"
								style={{ textAlign: "right", flexGrow: 10, whiteSpace: "nowrap" }}
							>
								<span className="monospace">{commit.sha.substr(0, 8)}</span>
							</span>
							<span />
						</div>
					);
				})
			);
		}
		return lines;
	}, [review]);

	return <>{changesetLines}</>;
};
