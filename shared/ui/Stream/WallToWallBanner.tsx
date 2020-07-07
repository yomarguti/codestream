import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { CodeStreamState } from "../store";
import { HostApi } from "../webview-api";
import Icon from "./Icon";
import { CSMe } from "@codestream/protocols/api";
import CancelButton from "./CancelButton";
import { setUserPreference } from "./actions";

interface Props {}

export function WallToWallBanner(props: Props) {
	const dispatch = useDispatch();
	const derivedState = useSelector((state: CodeStreamState) => {
		const { preferences = {} } = state;

		const showBanner =
			state.ide.name === "VSC" &&
			(state.editorContext.visibleEditorCount || 0) === 0 && // only populated (and used) by vscode
			!preferences.skipWallToWallBanner;
		return { showBanner };
	});

	const setSkip = () => dispatch(setUserPreference(["skipWallToWallBanner"], true));

	if (derivedState.showBanner)
		return (
			<div className="banner">
				<div id="wall-to-wall-banner">
					<div className="content">
						<Icon name="x" className="cancel-button clickable" onClick={setSkip} />
						CodeStream works best next to an editor window.{" "}
						<a href="https://docs.codestream.com/userguide/faq/cspane-in-vsc/">Learn more</a>.
					</div>
				</div>
			</div>
		);
	else return null;
}
