import React, { ReactNode } from "react";
import { useSelector } from "react-redux";
import { getCurrentSelection } from "@codestream/webview/store/editorContext/reducer";
import { CodeStreamState } from "@codestream/webview/store";
import ContainerAtEditorLine from "./ContainerAtEditorLine";

export default function ContainerAtEditorSelection(props: {
	initialLine?: number;
	children: ReactNode | ReactNode[];
}) {
	const initialRenderRef = React.useRef(true);
	React.useEffect(() => {
		initialRenderRef.current = false;
	}, []);

	const selectionStartLine = useSelector(
		(state: CodeStreamState) => getCurrentSelection(state.editorContext).start.line
	);

	const lineNumber =
		props.initialLine && initialRenderRef.current ? props.initialLine : selectionStartLine;

	return (
		<ContainerAtEditorLine lineNumber={lineNumber} repositionToFit className="cs-at-selection">
			{props.children}
		</ContainerAtEditorLine>
	);
}
