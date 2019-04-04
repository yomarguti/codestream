import React from "react";
import * as paths from "path-browserify";
import { escapeHtml } from "../utils";
import { prettyPrintOne } from "code-prettify";
import { HostApi } from "../webview-api";
import { ApplyMarkerRequestType, CompareMarkerRequestType } from "../ipc/webview.protocol";
import {
	Capabilities,
	CodemarkPlus,
	GetCodemarkSha1RequestType
} from "@codestream/protocols/agent";

interface State {
	hasDiff: boolean;
}

interface Props {
	codemark: CodemarkPlus;
	capabilities: Capabilities;
}

export default class CodemarkActions extends React.Component<Props, State> {
	private _div: HTMLDivElement | null = null;

	constructor(props) {
		super(props);
		this.state = { hasDiff: false };
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
		this.setState({ hasDiff: response.codemarkSha1 !== response.documentSha1 });
	}

	handleClickApplyPatch = event => {
		event.preventDefault();
		HostApi.instance.send(ApplyMarkerRequestType, { marker: this.props.codemark.markers![0] });
	};

	handleClickCompare = event => {
		event.preventDefault();
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
		if (marker != null) {
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
				{this.state.hasDiff && this.renderCodeblock()}
				{(canCompare || canApply || canOpenRevision) && (
					<div className="post-details" id={codemark.id}>
						<div className="a-group" key="a">
							{canCompare && (
								<a
									id="compare-button"
									className="control-button"
									tabIndex={2}
									onClick={this.handleClickCompare}
								>
									Compare
								</a>
							)}
							{canApply && (
								<a
									id="apply-button"
									className="control-button"
									tabIndex={3}
									onClick={this.handleClickApplyPatch}
								>
									Apply
								</a>
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
		return <pre className="code prettyprint" dangerouslySetInnerHTML={{ __html: codeHTML }} />;
	}
}
