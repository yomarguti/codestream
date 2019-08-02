import React from "react";
import Button from "./Button";
import { HostApi } from "../webview-api";
import { ShellPromptFolderRequestType } from "../ipc/host.protocol";
import { MapReposRequestType, RepoMap } from "@codestream/protocols/agent";
import { TelemetryRequestType } from "@codestream/protocols/agent";

interface Props {
	repoId: string | undefined;
	repoName: string;
	callback: Function;
}
interface State {
	locateLoading: boolean;
}
export class LocateRepoButton extends React.Component<Props, State> {
	state: State = {
		locateLoading: false
	};

	async locateCode() {
		HostApi.instance.send(TelemetryRequestType, { eventName: "Locate Repo" });

		const { repoId, repoName } = this.props;
		if (!repoId) return;

		this.setState({
			locateLoading: true
		});
		let response = await HostApi.instance.send(ShellPromptFolderRequestType, {
			message: `Please select the root folder for the ${repoName} repository.`
		});
		if (response && response.path) {
			const result = await HostApi.instance.send(MapReposRequestType, {
				repos: [{ repoId: repoId, ...response } as RepoMap]
			});

			if (this.props.callback) {
				await this.props.callback(result && result.success);
			}
		}
		this.setState({
			locateLoading: false
		});
	}

	render() {
		return (
			<Button
				className="btn-locate-repo"
				loading={this.state.locateLoading}				
				title="Locate this repository on your file system"
				onClick={event => {
					event.stopPropagation();
					this.locateCode();
				}}
			>
				Locate...
			</Button>
		);
	}
}
