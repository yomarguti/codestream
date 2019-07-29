import React, { ReactNode } from "react";
import { useSelector } from "react-redux";
import {
	getVisibleRanges,
	getVisibleLineCount,
	getLine0ForEditorLine
} from "@codestream/webview/store/editorContext/reducer";
import { CodeStreamState } from "@codestream/webview/store";

export default function ContainerAtEditorLine(props: {
	lineNumber: number;
	children: ReactNode | ReactNode[];
	className?: string;
}) {
	const { visibleLineCount, line0 } = useSelector((state: CodeStreamState) => {
		const visibleRanges = getVisibleRanges(state.editorContext);
		return {
			visibleLineCount: getVisibleLineCount(visibleRanges),
			line0: getLine0ForEditorLine(visibleRanges, props.lineNumber)
		};
	});

	const top = props.lineNumber > 0 ? (window.innerHeight * line0) / visibleLineCount : -1000;

	return (
		<span className={`plane-container ${props.className || ""}`} style={{ top }} data-top={top}>
			{props.children}
		</span>
	);
}
