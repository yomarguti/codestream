import React from "react";
import { ReviewChangesetFileInfo, FileStatus } from "@codestream/protocols/api";
import styled from "styled-components";

interface Props {
	className?: string;
	onClick?: React.MouseEventHandler;
	selected?: boolean;
	noHover?: boolean;
	icon?: any;
}

export const ChangesetFile = styled((props: ReviewChangesetFileInfo & Props) => {
	const { linesAdded, linesRemoved, status } = props;

	return (
		<div
			className={`${props.className} ${props.selected ? "selected" : ""} ${
				props.noHover ? "no-hover" : ""
			} ${
				props.icon ? "with-file-icon" : ""
			} row-with-icon-actions monospace ellipsis-left-container`}
			onClick={props.onClick}
		>
			{props.icon}
			<span className="file-info ellipsis-left">
				<bdi dir="ltr">{props.file}</bdi>
			</span>
			{linesAdded > 0 && <span className="added">+{linesAdded} </span>}
			{linesRemoved > 0 && <span className="deleted">-{linesRemoved}</span>}
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
