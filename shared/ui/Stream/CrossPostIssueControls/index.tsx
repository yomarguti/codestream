import React from "react";
import { connect } from "react-redux";
import { connectProvider } from "../../store/providers/actions";
import { openPanel, setIssueProvider } from "../../store/context/actions";
import { HostApi } from "../../webview-api";
import Icon from "../Icon";
import Menu from "../Menu";
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
import { CSMe, ProviderType } from "@codestream/protocols/api";
import Select from "react-select";

interface ProviderInfo {
	provider: ThirdPartyProviderConfig;
	display: ProviderDisplay;
}

interface Props {
	connectProvider(providerId: string): any;
	setIssueProvider(providerId?: string): void;
	openPanel(...args: Parameters<typeof openPanel>): void;
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
	isEditing?: boolean;
}

interface State {
	boards: ThirdPartyProviderBoard[];
	isLoading: boolean;
	loadingProvider?: ProviderInfo;
	issueProviderMenuOpen: boolean;
	issueProviderMenuTarget: any;
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
			loadingProvider,
			issueProviderMenuOpen: false,
			issueProviderMenuTarget: undefined
		};
	}

	componentDidMount() {
		const { issueProvider } = this.props;
		const providerInfo = issueProvider ? this.getProviderInfo(issueProvider.id) : undefined;
		if (issueProvider && providerInfo) {
			this.loadBoards(issueProvider);
		} else {
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
		} else if (!providerInfo && prevProps.issueProvider) {
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

		const response = await HostApi.instance.send(FetchThirdPartyBoardsRequestType, {
			providerId: provider.id
		});

		this.setState({
			isLoading: false,
			loadingProvider: undefined,
			boards: response.boards
		});
	}

	renderLoading() {
		const { loadingProvider } = this.state;

		return (
			<div className="connect-issue">
				<span>
					<Icon className="spin" name="sync" /> Syncing with {loadingProvider!.display.displayName}
					...
				</span>
				<a style={{ marginLeft: "5px" }} onClick={this.cancelLoading}>
					cancel
				</a>
			</div>
		);
	}

	cancelLoading = () => {
		this.setState({ isLoading: false });
		this.props.setIssueProvider(undefined);
	};

	renderProviderControls(providerOptions) {
		const { boards } = this.state;
		const { issueProvider } = this.props;
		const providerInfo = issueProvider ? this.getProviderInfo(issueProvider.id) : undefined;
		if (!providerInfo) {
			return null;
		}
		switch (providerInfo.provider.name) {
			case "jira":
			case "jiraserver": {
				return (
					<JiraCardControls
						boards={boards}
						onValues={this.props.onValues}
						provider={providerInfo.provider}
					>
						{providerOptions}
					</JiraCardControls>
				);
			}
			case "trello": {
				return (
					<TrelloCardControls
						boards={boards}
						onValues={this.props.onValues}
						provider={providerInfo.provider}
					>
						{providerOptions}
					</TrelloCardControls>
				);
			}
			case "asana": {
				return (
					<AsanaCardControls
						boards={boards}
						onValues={this.props.onValues}
						provider={providerInfo.provider}
					>
						{providerOptions}
					</AsanaCardControls>
				);
			}
			case "github":
			case "github_enterprise": {
				return (
					<GitHubCardControls
						boards={boards}
						onValues={this.props.onValues}
						provider={providerInfo.provider}
						codeBlock={this.props.codeBlock}
					>
						{providerOptions}
					</GitHubCardControls>
				);
			}
			case "gitlab": {
				return (
					<GitLabCardControls
						boards={boards}
						onValues={this.props.onValues}
						provider={providerInfo.provider}
						codeBlock={this.props.codeBlock}
					>
						{providerOptions}
					</GitLabCardControls>
				);
			}
			case "youtrack": {
				return (
					<YouTrackCardControls
						boards={boards}
						onValues={this.props.onValues}
						provider={providerInfo.provider}
					>
						{providerOptions}
					</YouTrackCardControls>
				);
			}
			case "bitbucket": {
				return (
					<BitbucketCardControls
						boards={boards}
						onValues={this.props.onValues}
						provider={providerInfo.provider}
						codeBlock={this.props.codeBlock}
					>
						{providerOptions}
					</BitbucketCardControls>
				);
			}
			case "azuredevops": {
				return (
					<AzureDevOpsCardControls
						boards={boards}
						onValues={this.props.onValues}
						provider={providerInfo.provider}
					>
						{providerOptions}
					</AzureDevOpsCardControls>
				);
			}

			default:
				return null;
		}
	}

	render() {
		const { issueProvider } = this.props;
		const providerInfo = issueProvider ? this.getProviderInfo(issueProvider.id) : undefined;
		const providerName = providerInfo && providerInfo.provider.name;

		if (this.state.isLoading) return this.renderLoading();

		if (!this.props.providers || !Object.keys(this.props.providers).length) return null;

		const knownIssueProviders = Object.keys(this.props.providers).filter(providerId => {
			const provider = this.props.providers![providerId];
			return provider.hasIssues && !!PROVIDER_MAPPINGS[provider.name];
		});
		if (knownIssueProviders.length === 0) {
			return null;
		}

		const knownIssueProviderOptions = knownIssueProviders
			.map(providerId => {
				const issueProvider = this.props.providers![providerId];
				const providerDisplay = PROVIDER_MAPPINGS[issueProvider.name];
				const displayName = issueProvider.isEnterprise
					? `${providerDisplay.displayName} - ${issueProvider.host}`
					: providerDisplay.displayName;
				return {
					value: providerId,
					label: displayName,
					action: providerId
				};
			})
			.sort((a, b) => a.label.localeCompare(b.label));
		knownIssueProviderOptions.unshift(
			{ label: "CodeStream only", value: "codestream", action: "codestream" },
			{ label: "-", value: "", action: "" }
		);
		const selectedProvider =
			providerInfo &&
			knownIssueProviderOptions.find(provider => provider.value === providerInfo.provider.id);

		const providerOptions = this.renderProviderOptions(selectedProvider, knownIssueProviderOptions);

		if (providerName) {
			return <div className="connect-issue">{this.renderProviderControls(providerOptions)}</div>;
		} else {
			return (
				<div className="connect-issue">
					<span className="connect-issue-label">Create an issue on</span>
					{providerOptions}
				</div>
			);
		}
	}

	renderProviderOptions = (selectedProvider, knownIssueProviderOptions) => {
		return (
			<span className="channel-label" onClick={this.switchIssueProvider}>
				{selectedProvider ? selectedProvider.label : "CodeStream Only (click for options)"}
				<Icon name="chevron-down" />
				{this.state.issueProviderMenuOpen && (
					<Menu
						align="center"
						compact={true}
						target={this.state.issueProviderMenuTarget}
						items={knownIssueProviderOptions}
						action={this.selectIssueProvider}
					/>
				)}
			</span>
		);
	};

	switchIssueProvider = (event: React.SyntheticEvent) => {
		if (this.props.isEditing) return;

		event.stopPropagation();
		const target = event.target;
		this.setState(state => ({
			issueProviderMenuOpen: !state.issueProviderMenuOpen,
			issueProviderMenuTarget: target
		}));
	};

	selectIssueProvider = providerId => {
		this.setState({ issueProviderMenuOpen: false });
		if (!providerId) return;
		if (providerId === "codestream") {
			this.props.setIssueProvider(undefined);
			return;
		}
		const issueProvider = this.props.providers![providerId];
		const providerDisplay = PROVIDER_MAPPINGS[issueProvider.name];
		this.onChangeProvider({ provider: issueProvider, display: providerDisplay });
	};

	async onChangeProvider(providerInfo: ProviderInfo) {
		this.setState({ isLoading: true, loadingProvider: providerInfo });
		if (providerInfo.provider.needsConfigure) {
			const { name, id } = providerInfo.provider;
			this.props.openPanel(`configure-provider-${name}-${id}`);
		} else if (providerInfo.provider.forEnterprise) {
			const { name, id } = providerInfo.provider;
			this.props.openPanel(`configure-enterprise-${name}-${id}`);
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
			providerInfo = providerInfo!.hosts![provider.id];
		}
		if (!providerInfo || !providerInfo.accessToken) return undefined;
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
	{ connectProvider, setIssueProvider, openPanel }
)(CrossPostIssueControls);

// {false && (
// 	<Select
// 		id="input-provider"
// 		name="providers"
// 		classNamePrefix="native-key-bindings react-select"
// 		value={selectedProvider}
// 		options={knownIssueProviderOptions}
// 		closeMenuOnSelect={true}
// 		isClearable={false}
// 		placeholder="select service"
// 		onChange={value => {
// 			const providerId = (value as { value: string })!.value;
// 			const issueProvider = this.props.providers![providerId];
// 			const providerDisplay = PROVIDER_MAPPINGS[issueProvider.name];
// 			this.onChangeProvider({ provider: issueProvider, display: providerDisplay });
// 		}}
// 		//tabIndex={this.tabIndex().toString()}
// 	/>
// )}
