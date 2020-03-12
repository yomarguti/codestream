import React from "react";
import * as Path from "path-browserify";
import { connect, useDispatch } from "react-redux";
import { prettyPrintOne } from "code-prettify";
import { CSMarker } from "@codestream/protocols/api";
import { escapeHtml, safe } from "../utils";
import Icon from "./Icon";
import { CodeStreamState } from "../store";
import { getById } from "../store/repos/reducer";
import { setCurrentCodemark, setCurrentReview } from "../store/context/actions";
import { SearchContext } from "./SearchContextProvider";

interface Props {
	marker: CSMarker;
	repoName?: string;
	className?: string;
}

function Marker(props: Props) {
	const { marker } = props;

	const dispatch = useDispatch();
	const searchContext = React.useContext(SearchContext);
	const goSearch = (e: React.SyntheticEvent, query: string) => {
		e.preventDefault();
		e.stopPropagation();

		dispatch(setCurrentCodemark());
		dispatch(setCurrentReview());
		searchContext.goToSearch(query);
	};

	const path = marker.file || "";
	let extension = Path.extname(path).toLowerCase();
	if (extension.startsWith(".")) {
		extension = extension.substring(1);
	}

	let startLine = 1;
	if (marker.locationWhenCreated && marker.locationWhenCreated.length)
		startLine = marker.locationWhenCreated[0];
	else if (marker.referenceLocations && marker.referenceLocations.length)
		startLine = marker.referenceLocations[0].location[0];

	const codeHTML = prettyPrintOne(escapeHtml(marker.code), extension, startLine);
	return (
		<div style={{ marginTop: "10px" }} className={props.className}>
			<div className="file-info">
				{props.repoName && (
					<>
						<a
							className="monospace internal-link"
							style={{ paddingRight: "20px" }}
							onClick={e => goSearch(e, `repo:"${props.repoName}"`)}
						>
							<Icon name="repo" />
							{props.repoName}
						</a>{" "}
					</>
				)}
				{marker.file && (
					<>
						<span className="monospace" style={{ paddingRight: "20px" }}>
							<Icon name="file" /> {marker.file}
						</span>{" "}
					</>
				)}
				{marker.branchWhenCreated && (
					<>
						<a
							className="monospace internal-link"
							style={{ paddingRight: "20px" }}
							onClick={e => goSearch(e, `branch:"${marker.branchWhenCreated}"`)}
						>
							<Icon name="git-branch" />
							{marker.branchWhenCreated}
						</a>{" "}
					</>
				)}
				{marker.commitHashWhenCreated && (
					<span className="monospace">
						<Icon name="git-commit-vertical" />
						{marker.commitHashWhenCreated.substring(0, 7)}
					</span>
				)}
			</div>
			<pre
				className="code prettyprint"
				data-scrollable="true"
				dangerouslySetInnerHTML={{ __html: codeHTML }}
			/>
		</div>
	);
}

const mapStateToProps = (state: CodeStreamState, props: Props) => {
	const { editorContext, context } = state;
	//console.log(ownState);

	const repoName =
		(props.marker && safe(() => getById(state.repos, props.marker.repoId).name)) || "";

	return { repoName };
};

const Component = connect(mapStateToProps)(Marker);

export { Component as Marker };
