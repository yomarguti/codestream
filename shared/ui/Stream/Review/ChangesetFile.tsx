import React from "react";
import { ReviewChangesetFileInfo, FileStatus } from "@codestream/protocols/api";
import styled from "styled-components";

export const ChangesetFile = styled((props: ReviewChangesetFileInfo & { className?: string, onClick: React.MouseEventHandler }) => {
	return (
		<div className={`${props.className} row-with-icon-actions monospace ellipsis-left-container`} onClick={props.onClick}>
			<span className="file-info ellipsis-left">
				<bdi dir="ltr">{props.file}</bdi>
			</span>
			{props.linesAdded > 0 && <span className="added">+{props.linesAdded} </span>}
			{props.linesRemoved > 0 && <span className="deleted">-{props.linesRemoved}</span>}
			{status === FileStatus.untracked && <span className="added">new </span>}
			{status === FileStatus.added && <span className="added">added </span>}
			{status === FileStatus.copied && <span className="added">copied </span>}
			{status === FileStatus.unmerged && <span className="deleted">conflict </span>}
			{status === FileStatus.deleted && <span className="deleted">deleted </span>}
		</div>
	);
})`
	width: 100%;
`;
