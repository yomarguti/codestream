import React from "react";
import * as paths from "path-browserify";
import { escapeHtml, safe } from "../utils";
import { prettyPrintOne } from "code-prettify";
import { HostApi } from "../webview-api";
import { LocateRepoButton } from "./LocateRepoButton";
import Tooltip from "./Tooltip";
import {
	ApplyMarkerRequestType,
	CompareMarkerRequestType,
	EditorSelectRangeRequestType
} from "../ipc/webview.protocol";
import {
	Capabilities,
	CodemarkPlus,
	GetCodemarkSha1RequestType,
	TelemetryRequestType,
	GetDocumentFromMarkerRequestType
} from "@codestream/protocols/agent";
import { injectIntl, InjectedIntl } from "react-intl";
import { CodeStreamState } from "../store";
import { connect } from "react-redux";
import { getById } from "../store/repos/reducer";
import Icon from "./Icon";

interface State {
	hasDiff: boolean;
	codemarkSha1: string | undefined;
	warning?: string;
}

interface ConnectedProps {
	repoName: string;
}

interface IntlProps {
	intl: InjectedIntl;
}

interface InheritedProps {
	codemark: CodemarkPlus;
	capabilities: Capabilities;
	isAuthor: boolean;
	alwaysRenderCode?: boolean;
}

type Props = InheritedProps & ConnectedProps & IntlProps;

class CodemarkActions extends React.Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { hasDiff: false, codemarkSha1: "" };
	}

	async componentDidMount() {
		const { codemark } = this.props;
		this.openCodemark(codemark);
	}

	async openCodemark(codemark: CodemarkPlus) {
		if (codemark == null) return;

		const marker =
			codemark.markers != null && codemark.markers.length !== 0 ? codemark.markers[0] : undefined;
		if (marker == null) return;

		try {
			const response = await HostApi.instance.send(GetCodemarkSha1RequestType, {
				codemarkId: codemark.id
			});
			this.setState({
				hasDiff:
					response.codemarkSha1 === undefined || response.codemarkSha1 !== response.documentSha1,
				codemarkSha1: response.codemarkSha1
			});
		} catch (error) {}

		try {
			if (marker.repoId) {
				const response = await HostApi.instance.send(GetDocumentFromMarkerRequestType, {
					markerId: marker.id
				});

				if (response) {
					const { success } = await HostApi.instance.send(EditorSelectRangeRequestType, {
						uri: response.textDocument.uri,
						// Ensure we put the cursor at the right line (don't actually select the whole range)
						selection: {
							start: response.range.start,
							end: response.range.start,
							cursor: response.range.start
						},
						preserveFocus: true
					});
					this.setState({ warning: success ? undefined : "FILE_NOT_FOUND" });					
				} else {
					// assumption based on GetDocumentFromMarkerRequestType api requiring the workspace to be available
					this.setState({ warning: "REPO_NOT_IN_WORKSPACE" });
				}
			} else this.setState({ warning: "NO_REMOTE" });
		} catch (error) {}
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

	getWarningMessage() {
		const { intl } = this.props;
		switch (this.state.warning) {
			case "NO_REMOTE": {
				const message = intl.formatMessage({
					id: "codeBlock.noRemote",
					defaultMessage: "This code does not have a remote URL associated with it."
				});
				const learnMore = intl.formatMessage({ id: "learnMore" });
				return (
					<span>
						{message}{" "}
						<a href="https://github.com/TeamCodeStream/CodeStream/wiki/Git-Issues">{learnMore}</a>
					</span>
				);
			}
			case "FILE_NOT_FOUND": {
				return (
					<span>
						{intl.formatMessage({
							id: "codeBlock.fileNotFound",
							defaultMessage: "You don’t currently have this file in your repo."
						})}
					</span>
				);
			}
			case "REPO_NOT_IN_WORKSPACE": {
				return (
					<span>
						<span>
							{intl.formatMessage(
								{
									id: "codeBlock.repoMissing",
									defaultMessage: "You don’t currently have the {repoName} repo open."
								},
								{ repoName: this.props.repoName }
							)}
							<LocateRepoButton
								repoId={
									this.props.codemark &&
									this.props.codemark.markers &&
									this.props.codemark.markers[0]
										? this.props.codemark.markers[0].repoId
										: undefined
								}
								repoName={this.props.repoName}
								callback={async success => {
									this.setState({ warning: success ? undefined : "REPO_NOT_IN_WORKSPACE" });
									if (success) {
										this.openCodemark(this.props.codemark);
									}
								}}
							></LocateRepoButton>
						</span>
					</span>
				);
			}
			case "UNKNOWN_LOCATION":
			default: {
				return (
					<span>
						{intl.formatMessage({
							id: "codeBlock.locationUnknown",
							defaultMessage: "Unknown code block location."
						})}
					</span>
				);
			}
		}
	}

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
				{(this.props.alwaysRenderCode || this.state.hasDiff || this.state.warning) &&
					this.renderCodeblock()}
				{(canCompare || canApply || canOpenRevision) && (
					<div className="post-details" id={codemark.id}>
						<div className="a-group" key="a">
							{canApply && (
								<Tooltip title="Apply patch to current buffer" placement="bottomRight" delay={1}>
									<div className="codemark-actions-button" onClick={this.handleClickApplyPatch}>
										Apply
									</div>
								</Tooltip>
							)}
							{canCompare && (
								<Tooltip title="Compare current code to original" placement="bottomRight" delay={1}>
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
				<div className="related-label">Original Code</div>
				{marker.branchWhenCreated && (
					<span className="monospace" style={{ paddingRight: "20px" }}>
						<Icon name="git-branch"></Icon> {marker.branchWhenCreated}
					</span>
				)}
				<span className="monospace">
					<Icon name="git-commit"></Icon> {marker.commitHashWhenCreated.substring(0, 7)}
				</span>
				{this.state.warning && (
					<div className="repo-warning">
						<Icon name="alert" /> {this.getWarningMessage()}
					</div>
				)}
				<pre
					className="code prettyprint"
					data-scrollable="true"
					dangerouslySetInnerHTML={{ __html: codeHTML }}
				/>
			</div>
		];
	}
}

const mapStateToProps = (state: CodeStreamState, props: InheritedProps) => {
	const repoName =
		(props.codemark &&
			safe(() => {
				return getById(state.repos, props.codemark.markers![0].repoId).name;
			})) ||
		"";

	return {
		repoName
	};
};

export default connect(mapStateToProps)(injectIntl(CodemarkActions));
