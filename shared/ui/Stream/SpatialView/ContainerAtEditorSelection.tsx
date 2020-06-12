import React from "react";
import { useSelector } from "react-redux";
import { getCurrentSelection } from "@codestream/webview/store/editorContext/reducer";
import { CodeStreamState } from "@codestream/webview/store";
import ContainerAtEditorLine from "./ContainerAtEditorLine";

export default function ContainerAtEditorSelection(
	props: React.PropsWithChildren<{
		className?: string;
	}>
) {
	const lineNumber = useSelector((state: CodeStreamState) => {
		const { textEditorUri } = state.editorContext;
		if (textEditorUri !== "" && textEditorUri != undefined) {
			const selection = getCurrentSelection(state.editorContext);
			if (selection) return selection.start.line;
			else return undefined;
		} else return undefined;
	});

	if (lineNumber == undefined) return null;

	return (
		<ContainerAtEditorLine
			lineNumber={lineNumber}
			repositionToFit
			className={`cs-at-selection ${props.className || ""}`}
		>
			{props.children}
		</ContainerAtEditorLine>
	);
}
