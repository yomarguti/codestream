import React from "react";
import { connect } from "react-redux";
import { connectProvider, setIssueProvider } from "../../store/context/actions";
import { HostApi } from "../../webview-api";
import Icon from "../Icon";
import AsanaCardControls from "./AsanaCardControls";
import BitbucketCardControls from "./BitbucketCardControls";
import GitHubCardControls from "./GitHubCardControls";
import GitLabCardControls from "./GitLabCardControls";
import JiraCardControls from "./JiraCardControls";
import TrelloCardControls from "./TrelloCardControls";
import YouTrackCardControls from "./YouTrackCardControls";
import AzureDevOpsCardControls from "./AzureDevOpsCardControls";
import { CrossPostIssueValuesListener, ProviderDisplay, PROVIDER_MAPPINGS } from "./types";
import {
	FetchThirdPartyBoardsRequestType,
	ThirdPartyProviderBoard,
	ThirdPartyProviderConfig,
	ThirdPartyProviders
} from "@codestream/protocols/agent";
import { CSMe } from "@codestream/protocols/api";

interface ProviderInfo {
	provider: ThirdPartyProviderConfig;
	display: ProviderDisplay;
}

interface Props {
	connectProvider(providerId: string): any;
	setIssueProvider(providerId?: string): void;
	onValues: CrossPostIssueValuesListener;
	issueProvider?: ThirdPartyProviderConfig;
	codeBlock?: {
		source?: {
			repoPath: string;
		};
	};
	providers?: ThirdPartyProviders;
	currentUser: CSMe;
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
		const providerInfo = props.issueProvider
			? this.getProviderInfo(props.issueProvider.id)
			: undefined;
		const isLoading = !!providerInfo;
		const loadingProvider = providerInfo;
		this.state = {
			boards: [],
			isLoading,
			loadingProvider
		};
	}

	componentDidMount() {
		const { issueProvider } = this.props;
		const providerInfo = issueProvider ? this.getProviderInfo(issueProvider.id) : undefined;
		if (this.props.issueProvider && providerInfo) {
			this.loadBoards(this.props.issueProvider);
		}
		else {
			this.props.setIssueProvider(undefined);
		}
	}

	componentDidUpdate(prevProps: Props, prevState: State) {
		const { issueProvider } = this.props;
		const providerInfo = issueProvider ? this.getProviderInfo(issueProvider.id) : undefined;
		if (
			providerInfo && 
			issueProvider && 
			(!prevProps.issueProvider || prevProps.issueProvider.id !== issueProvider.id)
		) {
			this.loadBoards(issueProvider!);
		}
		else if (!providerInfo && prevProps.issueProvider) {
			if (this.state.isLoading) {
				this.setState({ boards: [], isLoading: false, loadingProvider: undefined });
			}
		}
	}

	async loadBoards(provider: ThirdPartyProviderConfig) {
		const providerInfo = this.getProviderInfo(provider.id);
		if (!this.state.isLoading && providerInfo) {
			this.setState({
				isLoading: true,
				loadingProvider: providerInfo
			});
		}

		const response = await HostApi.instance.send(FetchThirdPartyBoardsRequestType, { providerId: provider.id });

		this.setState({
			isLoading: false,
			loadingProvider: undefined,
			boards: response.boards
		});
	}

	renderLoading() {
		const { loadingProvider } = this.state;

		return (
			<div className="checkbox-row">
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
		const providerInfo = issueProvider ? this.getProviderInfo(issueProvider.id) : undefined;
		if (!providerInfo) {
			return null;
		}
		switch (providerInfo.provider.name) {
			case "jira": {
				return (
					<JiraCardControls
						boards={boards}
						onValues={this.props.onValues}
						provider={providerInfo.provider}
					/>
				);
			}
			case "trello": {
				return (
					<TrelloCardControls
						boards={boards}
						onValues={this.props.onValues}
						provider={providerInfo.provider}
					/>
				);
			}
			case "asana": {
				return (
					<AsanaCardControls
						boards={boards}
						onValues={this.props.onValues}
						provider={providerInfo.provider}
					/>
				);
			}
			case "github": {
				return (
					<GitHubCardControls
						boards={boards}
						onValues={this.props.onValues}
						provider={providerInfo.provider}
						codeBlock={this.props.codeBlock}
					/>
				);
			}
			case "gitlab": {
				return (
					<GitLabCardControls
						boards={boards}
						onValues={this.props.onValues}
						provider={providerInfo.provider}
						codeBlock={this.props.codeBlock}
					/>
				);
			}
			case "youtrack": {
				return (
					<YouTrackCardControls
						boards={boards}
						onValues={this.props.onValues}
						provider={providerInfo.provider}
					/>
				);
			}
			case "bitbucket": {
				return (
					<BitbucketCardControls
						boards={boards}
						onValues={this.props.onValues}
						provider={providerInfo.provider}
						codeBlock={this.props.codeBlock}
					/>
				);
			}
			case "azuredevops": {
				return (
					<AzureDevOpsCardControls
						boards={boards}
						onValues={this.props.onValues}
						provider={providerInfo.provider}
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
		const providerInfo = issueProvider ? this.getProviderInfo(issueProvider.id) : undefined;
		if (providerInfo) {
			return this.renderProviderControls();
		} else if (this.props.providers && Object.keys(this.props.providers).length) {
			const knownIssueProviders = Object.keys(this.props.providers).filter(providerId => {
				const provider = this.props.providers![providerId];
				return (
					provider.hasIssues &&
					!!PROVIDER_MAPPINGS[provider.name]
				);
			});
			if (knownIssueProviders.length === 0) {
				return "";
			}
			return (
				<div className="checkbox-row connect-issue">
					<div className="connect-issue-label">Create an issue in </div>
					<div className="connect-issue-providers">
						{knownIssueProviders.map(providerId => {
							const issueProvider = this.props.providers![providerId];
							const providerDisplay = PROVIDER_MAPPINGS[issueProvider.name];
							const displayName = issueProvider.isEnterprise
								? `${providerDisplay.displayName} - ${issueProvider.host}`
								: providerDisplay.displayName;
							const icon = providerDisplay.icon || issueProvider.name;
							return (
								<span
									className="service"
									onClick={e =>
										this.handleClickConnectIssueProvider(e, {
											provider: issueProvider,
											display: providerDisplay
										})
									}
								>
									<Icon className={issueProvider!.name} name={icon} />
									{displayName}
								</span>
							);
						})}
					</div>
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
		if (providerInfo.provider.needsConfigure) {
			//this.props.setActivePanel(`configure-${providerInfo.provider.name}`);
		} else {
			await this.props.connectProvider(providerInfo.provider.id);
		}
	}

	getProviderInfo(providerId: string): ProviderInfo | undefined {
		const provider = this.props.providers ? this.props.providers[providerId] : undefined;
		if (!provider) return undefined;
		const display = provider ? PROVIDER_MAPPINGS[provider.name] : undefined;
		if (!display) return undefined;
		if (
			!this.props.currentUser.providerInfo ||
			!this.props.currentUser.providerInfo[this.props.currentTeamId] ||
			!this.props.currentUser.providerInfo[this.props.currentTeamId][provider.name]
		) {
			return;
		}
		let providerInfo = this.props.currentUser.providerInfo[this.props.currentTeamId][provider.name];
		if (provider.isEnterprise) {
			if (!providerInfo!.hosts) return undefined;
			providerInfo = providerInfo!.hosts[provider.id];
			if (!providerInfo || !providerInfo.accessToken) return undefined;
		}
		return { provider, display };
	}
}

const mapStateToProps = ({ providers, context, session, users }) => ({
	currentUser: users[session.userId],
	currentTeamId: context.currentTeamId,
	providers,
	issueProvider: providers[context.issueProvider]
});

export default connect(
	mapStateToProps,
	{ connectProvider, setIssueProvider }
)(CrossPostIssueControls);
