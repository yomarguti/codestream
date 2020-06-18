import React from "react";
import { connect } from "react-redux";
import { connectProvider, getUserProviderInfo } from "../../store/providers/actions";
import { openPanel, setIssueProvider } from "../../store/context/actions";
import Icon from "../Icon";
import Menu from "../Menu";
import { AsanaCardControls } from "./AsanaCardControls";
import { BitbucketCardControls } from "./BitbucketCardControls";
import { GitHubCardControls } from "./GitHubCardControls";
import { GitLabCardControls } from "./GitLabCardControls";
import { JiraCardControls } from "./JiraCardControls";
import { SlackCardControls } from "./SlackCardControls";
import { TrelloCardControls, TrelloCardDropdown } from "./TrelloCardControls";
import { YouTrackCardControls } from "./YouTrackCardControls";
import { AzureDevOpsCardControls } from "./AzureDevOpsCardControls";
import { ProviderDisplay, PROVIDER_MAPPINGS } from "./types";
import { ThirdPartyProviderConfig, ThirdPartyProviders } from "@codestream/protocols/agent";
import { CSMe } from "@codestream/protocols/api";
import { PrePRProviderInfoModalProps, PrePRProviderInfoModal } from "../PrePRProviderInfoModal";
import { CodeStreamState } from "@codestream/webview/store";
import { getConnectedProviderNames } from "@codestream/webview/store/providers/reducer";
import { updateForProvider } from "@codestream/webview/store/activeIntegrations/actions";

interface ProviderInfo {
	provider: ThirdPartyProviderConfig;
	display: ProviderDisplay;
}

interface ConnectedProps {
	connectedProviderNames: string[];
	currentTeamId: string;
	currentUser: CSMe;
	issueProviderConfig?: ThirdPartyProviderConfig;
	providers: ThirdPartyProviders;
}

interface Props extends ConnectedProps {
	connectProvider(...args: Parameters<typeof connectProvider>): any;
	updateForProvider(...args: Parameters<typeof updateForProvider>): any;
	setIssueProvider(providerId?: string): void;
	openPanel(...args: Parameters<typeof openPanel>): void;
	isEditing?: boolean;
	q?: string;
	focusInput?: React.RefObject<HTMLInputElement>;
}

interface State {
	isLoading: boolean;
	loadingProvider?: ProviderInfo;
	issueProviderMenuOpen: boolean;
	issueProviderMenuTarget: any;
	propsForPrePRProviderInfoModal?: PrePRProviderInfoModalProps;
}

class IssueDropdown extends React.Component<Props, State> {
	constructor(props: Props) {
		super(props);
		const providerInfo = props.issueProviderConfig
			? this.getProviderInfo(props.issueProviderConfig.id)
			: undefined;
		const loadingProvider = providerInfo;
		this.state = {
			isLoading: false,
			loadingProvider,
			issueProviderMenuOpen: false,
			issueProviderMenuTarget: undefined
		};
	}

	componentDidMount() {
		const { issueProviderConfig } = this.props;
		const providerInfo = issueProviderConfig
			? this.getProviderInfo(issueProviderConfig.id)
			: undefined;
		if (!issueProviderConfig || !providerInfo) {
			this.props.setIssueProvider(undefined);
		}
	}

	componentDidUpdate(prevProps: Props, prevState: State) {
		const { issueProviderConfig } = this.props;
		const providerInfo = issueProviderConfig
			? this.getProviderInfo(issueProviderConfig.id)
			: undefined;
		if (
			providerInfo &&
			issueProviderConfig &&
			(!prevProps.issueProviderConfig ||
				prevProps.issueProviderConfig.id !== issueProviderConfig.id)
		) {
			this.setState({ isLoading: false });
		} else if (!providerInfo && prevProps.issueProviderConfig) {
			if (this.state.isLoading) {
				this.setState({ isLoading: false, loadingProvider: undefined });
			}
		}
	}

	renderLoading() {
		return (
			<span className="dropdown-button" onClick={this.cancelLoading}>
				<Icon className="spin" name="sync" />
			</span>
		);
	}

	cancelLoading = () => {
		this.setState({ isLoading: false });
		this.props.setIssueProvider(undefined);
	};

	renderProviderControls(selectedProvider, knownIssueProviderOptions) {
		const { issueProviderConfig, q, focusInput } = this.props;
		const providerInfo = issueProviderConfig
			? this.getProviderInfo(issueProviderConfig.id)
			: undefined;

		if (!providerInfo)
			return this.renderProviderOptions(selectedProvider, knownIssueProviderOptions);

		switch (providerInfo.provider.name) {
			case "jira":
			case "jiraserver": {
				return <JiraCardControls provider={providerInfo.provider}></JiraCardControls>;
			}
			case "trello": {
				return (
					<TrelloCardDropdown
						provider={providerInfo.provider}
						q={q}
						focusInput={focusInput}
						selectedProvider={selectedProvider}
						knownIssueProviderOptions={knownIssueProviderOptions}
					></TrelloCardDropdown>
				);
			}
			case "asana": {
				return <AsanaCardControls provider={providerInfo.provider}></AsanaCardControls>;
			}
			case "github":
			case "github_enterprise": {
				return <GitHubCardControls provider={providerInfo.provider}></GitHubCardControls>;
			}
			case "gitlab":
			case "gitlab_enterprise": {
				return <GitLabCardControls provider={providerInfo.provider}></GitLabCardControls>;
			}
			case "youtrack": {
				return <YouTrackCardControls provider={providerInfo.provider}></YouTrackCardControls>;
			}
			case "bitbucket": {
				return <BitbucketCardControls provider={providerInfo.provider}></BitbucketCardControls>;
			}
			case "azuredevops": {
				return <AzureDevOpsCardControls provider={providerInfo.provider}></AzureDevOpsCardControls>;
			}
			case "slack": {
				return <SlackCardControls provider={providerInfo.provider}></SlackCardControls>;
			}

			default:
				return null;
		}
	}

	render() {
		const { issueProviderConfig } = this.props;
		const providerInfo = issueProviderConfig
			? this.getProviderInfo(issueProviderConfig.id)
			: undefined;

		if (this.state.isLoading) return this.renderLoading();

		if (!this.props.providers || !Object.keys(this.props.providers).length) return null;

		const knownIssueProviders = Object.keys(this.props.providers).filter(providerId => {
			const provider = this.props.providers![providerId];
			return provider.hasIssues && !!PROVIDER_MAPPINGS[provider.name];
		});
		if (knownIssueProviders.length === 0) {
			return null;
		}

		const selectedProviderId = providerInfo && providerInfo.provider.id;
		const knownIssueProviderOptions = knownIssueProviders
			.map(providerId => {
				const issueProvider = this.props.providers![providerId];
				const providerDisplay = PROVIDER_MAPPINGS[issueProvider.name];
				const displayName = issueProvider.isEnterprise
					? `${providerDisplay.displayName} - ${issueProvider.host}`
					: providerDisplay.displayName;
				return {
					// icon: <Icon name={providerDisplay.icon || "blank"} />,
					checked: providerId == selectedProviderId,
					value: providerId,
					label: displayName,
					key: providerId,
					action: () => this.selectIssueProvider(providerId)
				};
			})
			.sort((a, b) => a.label.localeCompare(b.label));

		const selectedProvider =
			providerInfo &&
			knownIssueProviderOptions.find(provider => provider.value === selectedProviderId);

		return (
			<>
				{this.state.propsForPrePRProviderInfoModal && (
					<PrePRProviderInfoModal {...this.state.propsForPrePRProviderInfoModal} />
				)}
				{this.renderProviderControls(selectedProvider, knownIssueProviderOptions)}
			</>
		);
	}

	renderProviderOptions = (selectedProvider, knownIssueProviderOptions) => {
		return (
			<span className="dropdown-button" onClick={this.switchIssueProvider}>
				<Icon name="chevron-down" />
				{this.state.issueProviderMenuOpen && (
					<Menu
						align="dropdownRight"
						target={this.state.issueProviderMenuTarget}
						items={knownIssueProviderOptions}
						action={() => {}}
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
			// @ts-ignore
			issueProviderMenuTarget: target.closest(".dropdown-button")
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
		if (
			providerInfo.provider.needsConfigure &&
			!this.providerIsConnected(providerInfo.provider.id)
		) {
			const { name, id } = providerInfo.provider;
			this.props.openPanel(`configure-provider-${name}-${id}-Compose Modal`);
		} else if (
			providerInfo.provider.forEnterprise &&
			!this.providerIsConnected(providerInfo.provider.id)
		) {
			const { name, id } = providerInfo.provider;
			/* if (name === "github_enterprise") {
				this.setState({
					propsForPrePRProviderInfoModal: {
						providerName: name,
						onClose: () => this.setState({ propsForPrePRProviderInfoModal: undefined }),
						action: () => this.props.openPanel(`configure-enterprise-${name}-${id}`)
					}
				});
			} else */ this.props.openPanel(
				`configure-enterprise-${name}-${id}-Compose Modal`
			);
		} else {
			const { name } = providerInfo.provider;
			const { connectedProviderNames, issueProviderConfig } = this.props;
			const newValueIsNotCurrentProvider =
				issueProviderConfig == undefined || issueProviderConfig.name !== name;
			const newValueIsNotAlreadyConnected = !connectedProviderNames.includes(name);
			if (
				newValueIsNotCurrentProvider &&
				newValueIsNotAlreadyConnected &&
				(name === "github" || name === "bitbucket" || name === "gitlab")
			) {
				this.setState({
					propsForPrePRProviderInfoModal: {
						providerName: name,
						onClose: () => {
							this.setState({ propsForPrePRProviderInfoModal: undefined });
						},
						action: () => {
							this.setState({ isLoading: true, loadingProvider: providerInfo });
							this.props.connectProvider(providerInfo.provider.id, "Status Panel");
						}
					}
				});
			} else {
				this.setState({ isLoading: true, loadingProvider: providerInfo });
				const ret = await this.props.connectProvider(providerInfo.provider.id, "Status Panel");
				if (ret && ret.alreadyConnected) this.setState({ isLoading: false });
			}
		}
	}

	getProviderInfo(providerId: string): ProviderInfo | undefined {
		const provider = this.props.providers ? this.props.providers[providerId] : undefined;
		if (!provider) return undefined;
		const display = provider ? PROVIDER_MAPPINGS[provider.name] : undefined;
		if (!display) return undefined;
		let providerInfo = getUserProviderInfo(
			this.props.currentUser,
			provider.name,
			this.props.currentTeamId
		);
		if (!providerInfo) return undefined;
		if (provider.isEnterprise) {
			if (!providerInfo.hosts) return undefined;
			providerInfo = providerInfo.hosts[provider.id];
		}
		if (!providerInfo.accessToken) return undefined;
		return { provider, display };
	}

	providerIsConnected(providerId: string): boolean {
		const provider = this.props.providers ? this.props.providers[providerId] : undefined;
		const { currentUser } = this.props;
		if (!provider || currentUser.providerInfo == undefined) return false;
		let providerInfo = currentUser.providerInfo[this.props.currentTeamId][provider.name];
		if (!providerInfo) return false;
		if (providerInfo.accessToken) return true;
		if (!provider.isEnterprise) return false;
		if (!providerInfo!.hosts) return false;
		providerInfo = providerInfo!.hosts![provider.id];
		return providerInfo && !!providerInfo.accessToken;
	}
}

const mapStateToProps = (state: CodeStreamState): ConnectedProps => {
	const { users, session, context, providers } = state;
	const currentIssueProviderConfig = context.issueProvider
		? providers[context.issueProvider]
		: undefined;

	return {
		currentUser: users[session.userId!] as CSMe,
		currentTeamId: context.currentTeamId,
		providers,
		issueProviderConfig: currentIssueProviderConfig,
		connectedProviderNames: getConnectedProviderNames(state)
	};
};

export default connect(mapStateToProps, {
	connectProvider,
	setIssueProvider,
	openPanel,
	updateForProvider
})(IssueDropdown);
