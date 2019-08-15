import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { CodeStreamState } from "../store";
import { getCodemark } from "../store/codemarks/reducer";
import { Loading } from "../Container/Loading";
import Codemark from "./Codemark";
import CancelButton from "./CancelButton";
import { DelayedRender } from "../Container/DelayedRender";
import { setCurrentCodemark } from "../store/context/actions";
import VsCodeKeystrokeDispatcher from "../utilities/vscode-keystroke-dispatcher";
import { HostApi } from "../webview-api";
import { GetDocumentFromMarkerRequestType } from "@codestream/protocols/agent";
import { EditorSelectRangeRequestType } from "@codestream/protocols/webview";

async function moveCursorToLine(markerId: string) {
	const hostApi = HostApi.instance;
	try {
		const response = await hostApi.send(GetDocumentFromMarkerRequestType, {
			markerId: markerId
		});

		// TODO: What should we do if we don't find the marker? Is that possible?
		if (response) {
			// Ensure we put the cursor at the right line (don't actually select the whole range)
			hostApi.send(EditorSelectRangeRequestType, {
				uri: response.textDocument.uri,
				selection: {
					start: response.range.start,
					end: response.range.start,
					cursor: response.range.start
				},
				preserveFocus: true
			});
		}
	} catch (error) {
		// TODO:
	}
}

export function CodemarkView() {
	const dispatch = useDispatch();
	const codemark = useSelector((state: CodeStreamState) => {
		return getCodemark(state.codemarks, state.context.currentCodemarkId);
	});

	React.useEffect(() => {
		if (codemark == undefined) {
			// TODO: fetch it when we have the api for that
		}

		const subscription = VsCodeKeystrokeDispatcher.on("keydown", event => {
			if (event.key === "Escape") {
				event.stopPropagation();
				dispatch(setCurrentCodemark());
			}
		});

		return () => {
			subscription.dispose();
		};
	}, []);

	React.useEffect(() => {
		if (!codemark) return;

		let markerId: string | undefined;
		if (codemark.markers) {
			markerId = codemark.markers[0].id;
		} else if (codemark.markerIds) {
			markerId = codemark.markerIds[0];
		}

		if (markerId) {
			moveCursorToLine(markerId);
		}
	}, [codemark && codemark.id]);

	const handleClickCancel = React.useCallback(event => {
		event.preventDefault();
		dispatch(setCurrentCodemark());
	}, []);

	if (codemark == undefined)
		return (
			<DelayedRender>
				<Loading />
			</DelayedRender>
		);

	return (
		<div className="codemark-view">
			<CancelButton className="cancel-icon clickable" onClick={handleClickCancel} />
			<div className="codemark-container">
				<Codemark codemark={codemark} selected highlightCodeInTextEditor />
			</div>
		</div>
	);
}
