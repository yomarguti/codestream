import React from "react";
import * as paths from "path-browserify";
import { escapeHtml } from "../utils";
import { prettyPrintOne } from "code-prettify";
import { HostApi } from "../webview-api";
import Tooltip from "./Tooltip";
import { ApplyMarkerRequestType, CompareMarkerRequestType } from "../ipc/webview.protocol";
import {
	Capabilities,
	CodemarkPlus,
	GetCodemarkSha1RequestType,
	TelemetryRequestType
} from "@codestream/protocols/agent";

interface State {
	hasDiff: boolean;
	codemarkSha1: string | undefined;
}

interface Props {
	codemark: CodemarkPlus;
	capabilities: Capabilities;
	isAuthor: boolean;
	alwaysRenderCode?: boolean;
}

export default class CodemarkActions extends React.Component<Props, State> {
	private _div: HTMLDivElement | null = null;

	constructor(props) {
		super(props);
		this.state = { hasDiff: false, codemarkSha1: "" };
	}

	async componentDidMount() {
		const { codemark } = this.props;
		if (codemark == null) return;

		const marker =
			codemark.markers != null && codemark.markers.length !== 0 ? codemark.markers[0] : undefined;
		if (marker == null) return;

		const response = await HostApi.instance.send(GetCodemarkSha1RequestType, {
			codemarkId: codemark.id
		});
		this.setState({
			hasDiff:
				response.codemarkSha1 === undefined || response.codemarkSha1 !== response.documentSha1,
			codemarkSha1: response.codemarkSha1
		});
	}

	handleClickApplyPatch = event => {
		event.preventDefault();
		HostApi.instance.send(TelemetryRequestType, {
			eventName: "Apply",
			properties: { "Author?": this.props.isAuthor }
		});
		HostApi.instance.send(ApplyMarkerRequestType, { marker: this.props.codemark.markers![0] });
	};

	handleClickCompare = event => {
		event.preventDefault();
		event.stopPropagation();
		HostApi.instance.send(TelemetryRequestType, {
			eventName: "Compare",
			properties: { "Author?": this.props.isAuthor }
		});
		HostApi.instance.send(CompareMarkerRequestType, { marker: this.props.codemark.markers![0] });
	};

	handleClickOpenRevision = event => {
		event.preventDefault();
		// HostApi.instance.send(OpenRevisionMarkerRequestType, { marker: this.props.codemark.markers![0] });
	};

	render() {
		const { codemark } = this.props;
		if (codemark == null) return null;

		let {
			codemarkCompare: canCompare = false,
			codemarkApply: canApply = false,
			codemarkOpenRevision: canOpenRevision = false
		} = this.props.capabilities;

		const marker =
			codemark.markers != null && codemark.markers.length !== 0 ? codemark.markers[0] : undefined;
		let ref;
		if (marker != null && marker.commitHashWhenCreated) {
			ref = marker.commitHashWhenCreated.substr(0, 8);
			if ((canCompare || canApply) && !this.state.hasDiff) {
				canCompare = false;
				canApply = false;
			}
		} else {
			ref = "";
			canCompare = false;
			canApply = false;
			canOpenRevision = false;
		}

		return (
			<>
				{(this.props.alwaysRenderCode || this.state.hasDiff) && this.renderCodeblock()}
				{(canCompare || canApply || canOpenRevision) && (
					<div className="post-details" id={codemark.id}>
						<div className="a-group" key="a">
							{canApply && (
								<Tooltip title="Apply patch to current buffer" placement="bottomRight">
									<div className="codemark-actions-button" onClick={this.handleClickApplyPatch}>
										Apply
									</div>
								</Tooltip>
							)}
							{canCompare && (
								<Tooltip title="Compare current code to original" placement="bottomRight">
									<div className="codemark-actions-button" onClick={this.handleClickCompare}>
										Compare
									</div>
								</Tooltip>
							)}
							{canOpenRevision && (
								<a
									id="open-revision-button"
									className="control-button"
									tabIndex={4}
									onClick={this.handleClickOpenRevision}
								>
									Open Revision {ref}
								</a>
							)}
						</div>
						<div key="b" style={{ clear: "both" }} />
					</div>
				)}
			</>
		);
	}

	renderCodeblock() {
		const { codemark } = this.props;
		const markers = codemark.markers;
		if (!markers) return null;

		const marker = codemark.markers![0];
		if (marker === undefined) return;

		const path = marker.file || "";
		let extension = paths.extname(path).toLowerCase();
		if (extension.startsWith(".")) {
			extension = extension.substring(1);
		}

		let startLine = 1;
		// `range` is not a property of CSMarker
		/* if (marker.range) {
			startLine = marker.range.start.line;
		} else if (marker.location) {
			startLine = marker.location[0];
		} else */ if (
			marker.locationWhenCreated
		) {
			startLine = marker.locationWhenCreated[0];
		}

		const codeHTML = prettyPrintOne(escapeHtml(marker.code), extension, startLine);
		return [
			<div className="related" style={{ padding: "0 10px", marginBottom: 0 }}>
				<div className="related-label">
					Original Code <span>(from {marker.commitHashWhenCreated.substring(0, 6)})</span>
				</div>
				<pre
					className="code prettyprint"
					data-scrollable="true"
					dangerouslySetInnerHTML={{ __html: codeHTML }}
				/>
			</div>
		];
	}
}
