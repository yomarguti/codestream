import React from "react";
import { connect } from "react-redux";
import { connectProvider } from "../../store/context/actions";
import { HostApi } from "../../webview-api";
import Icon from "../Icon";
import AsanaCardControls from "./AsanaCardControls";
import BitbucketCardControls from "./BitbucketCardControls";
import GitHubCardControls from "./GitHubCardControls";
import GitLabCardControls from "./GitLabCardControls";
import JiraCardControls from "./JiraCardControls";
import TrelloCardControls from "./TrelloCardControls";
import {
	CrossPostIssueValuesListener,
	ProviderDisplay,
	PROVIDER_MAPPINGS
} from "./types";
import { 
	FetchThirdPartyBoardsRequestType,	
	ThirdPartyProviderBoard,
	ThirdPartyProviderInstance
} from "@codestream/protocols/agent";
import { RequestType } from "vscode-jsonrpc";
import { IpcRoutes } from "@codestream/protocols/webview";

interface ProviderInfo {
	provider: ThirdPartyProviderInstance;
	display: ProviderDisplay;
}

interface Props {
	connectProvider(provider: ThirdPartyProviderInstance): any;
	onValues: CrossPostIssueValuesListener;
	issueProvider?: ThirdPartyProviderInstance;
	codeBlock?: {
		source?: {
			repoPath: string;
		};
	};
	providers?: ThirdPartyProviderInstance[];
	currentTeamId: string;
}

interface State {
	boards: ThirdPartyProviderBoard[];
	isLoading: boolean;
	loadingProvider?: ProviderInfo;
}

class CrossPostIssueControls extends React.Component<Props, State> {
	constructor(props: Props) {
		super(props);
		const providerInfo = props.issueProvider ? this.getProviderInfo(props.issueProvider) : undefined;
		const isLoading = !!providerInfo;
		const loadingProvider = providerInfo;
		this.state = {
			boards: [],
			isLoading,
			loadingProvider
		};
	}

	componentDidMount() {
		if (this.props.issueProvider) {
			this.loadBoards(this.props.issueProvider);
		}
	}

	componentDidUpdate(prevProps: Props, prevState: State) {
		const { issueProvider } = this.props;
		const providerInfo = issueProvider ? this.getProviderInfo(issueProvider) : undefined;
		if (providerInfo && !prevProps.issueProvider) {
			this.loadBoards(issueProvider!);
		}
		if (!providerInfo && prevProps.issueProvider) {
			this.setState({ boards: [], isLoading: false, loadingProvider: undefined });
		}
	}

	async loadBoards(provider: ThirdPartyProviderInstance) {
		const providerInfo = this.getProviderInfo(provider);
		if (!this.state.isLoading && providerInfo) {
			this.setState({
				isLoading: true,
				loadingProvider: providerInfo
			});
		}

		const response = await HostApi.instance.send(FetchThirdPartyBoardsRequestType, { provider });

		this.setState({
			isLoading: false,
			loadingProvider: undefined,
			boards: response.boards
		});
	}

	renderLoading() {
		const { loadingProvider } = this.state;

		return (
			<div className="checkbox-row connect-issue">
				<span>
					<Icon className="spin" name="sync" /> Syncing with {loadingProvider!.display.displayName}
					...
				</span>
			</div>
		);
	}

	renderProviderControls() {
		const { boards } = this.state;
		const { issueProvider } = this.props;
		const providerInfo = issueProvider ? this.getProviderInfo(issueProvider) : undefined;
		if (!providerInfo) {
			return null;
		}
		switch (issueProvider!.name) {
			case 'jira': {
				return (
					<JiraCardControls 
						boards={boards}
						onValues={this.props.onValues}
						provider={providerInfo.provider}
					/>
				);
			}
			case 'trello': {
				return (
					<TrelloCardControls
						boards={boards} 
						onValues={this.props.onValues}
						provider={providerInfo.provider}
					/>
				);
			}
			case 'asana': {
				return (
					<AsanaCardControls
						boards={boards}
						onValues={this.props.onValues}
						provider={providerInfo.provider}
					/>
				);
			}
			case 'github': {
				return (
					<GitHubCardControls
						boards={boards}
						onValues={this.props.onValues}
						provider={providerInfo.provider}
						codeBlock={this.props.codeBlock}
					/>
				);
			}
			case 'gitlab': {
				return (
					<GitLabCardControls
						boards={boards}
						onValues={this.props.onValues}
						provider={providerInfo.provider}
						codeBlock={this.props.codeBlock}
					/>
				);
			}
			case 'bitbucket': {
				return (
					<BitbucketCardControls
						boards={boards}
						onValues={this.props.onValues}
						provider={providerInfo.provider}
						codeBlock={this.props.codeBlock}
					/>
				);
			}
			default:
				return null;
		}
	}

	render() {
		if (this.state.isLoading) {
			return this.renderLoading();
		}
		const { issueProvider } = this.props;
		const providerInfo = issueProvider ? this.getProviderInfo(issueProvider) : undefined;
		if (providerInfo) {
			return this.renderProviderControls();
		} else if (
			this.props.providers &&
			Object.keys(this.props.providers).length
		) {
			const knownIssueProviders = this.props.providers.filter(provider => {
				return (
					(!provider.teamId || provider.teamId === this.props.currentTeamId) && 
					provider.hasIssues &&
					!!PROVIDER_MAPPINGS[provider.name]
				);
			});
			if (knownIssueProviders.length === 0) {
				return "";
			}
			return (
				<div className="checkbox-row connect-issue">
					Create an issue in{" "}
					{knownIssueProviders.map(issueProvider => {
						const providerDisplay = PROVIDER_MAPPINGS[issueProvider.name];
						const displayName = issueProvider.isEnterprise ?
							`${providerDisplay.displayName} - ${issueProvider.host}` :
							providerDisplay.displayName;
						const icon = providerDisplay.icon || issueProvider.name;
						return (
							<span
								className="service"
								onClick={e => 
									this.handleClickConnectIssueProvider(e, { provider: issueProvider, display: providerDisplay})
								}
							>
								<Icon className={issueProvider!.name} name={icon} />
								{displayName}
							</span>
						);
					})}
				</div>
			);
		} else {
			return "";
		}
	}

	async handleClickConnectIssueProvider(
		event: React.SyntheticEvent,
		providerInfo: ProviderInfo
	): Promise<void> {
		event.preventDefault();
		this.setState({ isLoading: true, loadingProvider: providerInfo });
		await this.props.connectProvider(providerInfo.provider);
	}

	getProviderInfo(wantProvider: ThirdPartyProviderInstance): ProviderInfo | undefined {
		const provider =
			this.props.providers &&
			this.props.providers.find(provider => provider.host === wantProvider.host);
		const display = provider ? PROVIDER_MAPPINGS[provider.name] : undefined;
		if (provider && display) {
			return { provider, display };
		} else {
			return undefined;
		}
	}
}

const mapStateToProps = ({ providers, context }) => ({
	providers,
	currentTeamId: context.currentTeamId
});

export default connect(
	mapStateToProps,
	{ connectProvider }
)(CrossPostIssueControls);
