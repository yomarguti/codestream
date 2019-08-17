import React, { ReactNode } from "react";
import { useSelector } from "react-redux";
import { getCurrentSelection } from "@codestream/webview/store/editorContext/reducer";
import { CodeStreamState } from "@codestream/webview/store";
import ContainerAtEditorLine from "./ContainerAtEditorLine";

export default function ContainerAtEditorSelection(props: { children: ReactNode | ReactNode[] }) {
	const lineNumber = useSelector(
		(state: CodeStreamState) => getCurrentSelection(state.editorContext).start.line
	);

	return (
		<ContainerAtEditorLine lineNumber={lineNumber} repositionToFit className="cs-at-selection">
			{props.children}
		</ContainerAtEditorLine>
	);
}
