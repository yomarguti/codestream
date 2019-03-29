import React, { Component } from "react";
import Button from "./Button";
import { HostApi } from "../webview-api";
import { CompareMarkerRequestType, ApplyMarkerRequestType } from "../ipc/webview.protocol";

export default class PostDetails extends Component {
	handleClickShowDiff = event => {
		event.preventDefault();
		HostApi.instance.send(CompareMarkerRequestType, { marker: this.props.codemark.markers[0] });
	};

	handleClickApplyPatch = event => {
		event.preventDefault();
		HostApi.instance.send(ApplyMarkerRequestType, { marker: this.props.codemark.markers[0] });
	};

	render() {
		const { codemark } = this.props;

		if (!codemark) return null;

		const hasCodeBlock =
			(codemark.markers && codemark.markers.length) ||
			(codemark.markerIds && codemark.markerIds.length)
				? true
				: null;
		let canCompare = hasCodeBlock && this.props.capabilities.codemarkCompare;
		let canApply = hasCodeBlock && this.props.capabilities.codemarkApply;
		let canLoad = hasCodeBlock && this.props.capabilities.loadCommitHash;

		return (
			<div className="post-details" id={codemark.id} ref={ref => (this._div = ref)}>
				{(canCompare || canApply || hasCodeBlock) && [
					<div className="a-group" key="a">
						{canCompare && (
							<a
								id="compare-button"
								className="control-button"
								tabIndex="2"
								onClick={this.handleClickShowDiff}
							>
								Compare
							</a>
						)}
						{canApply && (
							<a
								id="apply-button"
								className="control-button"
								tabIndex="3"
								onClick={this.handleClickApplyPatch}
							>
								Apply
							</a>
						)}
						{canLoad && (
							<a
								id="apply-button"
								className="control-button"
								tabIndex="4"
								onClick={this.handleClickApplyPatch}
							>
								Load {codemark.markers[0].commitHashWhenCreated.substr(0, 8)}
							</a>
						)}
					</div>,
					<div key="b" style={{ clear: "both" }} />
				]}
			</div>
		);
	}
}
