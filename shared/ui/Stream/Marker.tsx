import React from "react";
import * as Path from "path-browserify";
import { connect } from "react-redux";
import { prettyPrintOne } from "code-prettify";
import { CSMarker } from "@codestream/protocols/api";
import { escapeHtml } from "../utils";
import Icon from "./Icon";

interface Props {
	marker: CSMarker;
}

function Marker(props: Props) {
	const { marker } = props;

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
		<div style={{ marginTop: "10px" }}>
			<div className="file-info">
				{marker.file && (
					<>
						<span className="monospace" style={{ paddingRight: "20px" }}>
							<Icon name="file" /> {marker.file}
						</span>{" "}
					</>
				)}
				{marker.branchWhenCreated && (
					<>
						<span className="monospace" style={{ paddingRight: "20px" }}>
							<Icon name="git-branch" /> {marker.branchWhenCreated}
						</span>{" "}
					</>
				)}
				{marker.commitHashWhenCreated && (
					<span className="monospace">
						<Icon name="git-commit" /> {marker.commitHashWhenCreated.substring(0, 7)}
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

const mapStateToProps = (state, props: Props) => ({});

const Component = connect(mapStateToProps)(Marker);

export { Component as Marker };
