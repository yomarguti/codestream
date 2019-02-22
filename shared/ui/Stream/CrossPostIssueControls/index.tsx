import * as React from "react";
import { connect } from "react-redux";
import { getFetchIssueBoardsCommand } from "../../ipc/webview.protocol";
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
	Board,
	CrossPostIssueValuesListener,
	getProviderInfo,
	Service,
	SUPPORTED_SERVICES
} from "./types";

interface Props {
	connectProvider(name: string): any;
	onValues: CrossPostIssueValuesListener;
	provider?: string;
	codeBlock?: {
		source?: {
			repoPath: string;
		};
	};
}

interface State {
	boards: Board[];
	isLoading: boolean;
	loadingProvider?: Service;
}

class CrossPostIssueControls extends React.Component<Props, State> {
	constructor(props: Props) {
		super(props);
		const isLoading = props.provider ? true : false;
		const loadingProvider = isLoading ? getProviderInfo(props.provider!) : undefined;
		this.state = {
			boards: [],
			isLoading,
			loadingProvider
		};
	}

	componentDidMount() {
		if (this.props.provider) {
			this.loadBoards(this.props.provider);
		}
	}

	componentDidUpdate(prevProps: Props, prevState: State) {
		const { provider } = this.props;
		if (provider && !prevProps.provider) {
			this.loadBoards(provider);
		}
		if (!provider && prevProps.provider) {
			this.setState({ boards: [], isLoading: false, loadingProvider: undefined });
		}
	}

	async loadBoards(provider: string) {
		if (!this.state.isLoading) {
			this.setState({
				isLoading: true,
				loadingProvider: getProviderInfo(provider)
			});
		}

		const response = await HostApi.instance.send(getFetchIssueBoardsCommand(provider), {});

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
					<Icon className="spin" name="sync" /> Syncing with {(loadingProvider as any).displayName}
					...
				</span>
			</div>
		);
	}

	renderProviderControls() {
		const { boards } = this.state;
		switch (this.props.provider) {
			case SUPPORTED_SERVICES.Jira.name: {
				return <JiraCardControls boards={boards} onValues={this.props.onValues} />;
			}
			case SUPPORTED_SERVICES.Trello.name: {
				return <TrelloCardControls boards={boards} onValues={this.props.onValues} />;
			}
			case SUPPORTED_SERVICES.Asana.name: {
				return <AsanaCardControls boards={boards} onValues={this.props.onValues} />;
			}
			case SUPPORTED_SERVICES.GitHub.name: {
				return (
					<GitHubCardControls
						boards={boards}
						onValues={this.props.onValues}
						codeBlock={this.props.codeBlock}
					/>
				);
			}
			case SUPPORTED_SERVICES.GitLab.name: {
				return (
					<GitLabCardControls
						boards={boards}
						onValues={this.props.onValues}
						codeBlock={this.props.codeBlock}
					/>
				);
			}
			case SUPPORTED_SERVICES.Bitbucket.name: {
				return (
					<BitbucketCardControls
						boards={boards}
						onValues={this.props.onValues}
						codeBlock={this.props.codeBlock}
					/>
				);
			}
			default:
				return null;
		}
	}

	render() {
		if (this.state.isLoading) return this.renderLoading();
		else if (this.props.provider) {
			return this.renderProviderControls();
		} else {
			return (
				<div className="checkbox-row connect-issue">
					Create an issue in{" "}
					{Object.values(SUPPORTED_SERVICES).map((service: Service) => (
						<span
							className="service"
							onClick={e => this.handleClickConnectIssueService(e, service)}
						>
							<Icon className={service.name} name={service.icon || service.name} />
							{service.displayName}
						</span>
					))}
				</div>
			);
		}
	}

	async handleClickConnectIssueService(
		event: React.SyntheticEvent,
		service: Service
	): Promise<void> {
		event.preventDefault();
		this.setState({ isLoading: true, loadingProvider: service });
		switch (service.name) {
			case "trello":
			case "asana":
			case "jira":
			case "github":
			case "gitlab":
			case "bitbucket":
				await this.props.connectProvider(service.name);
				break;
		}
	}
}

export default connect(
	null,
	{ connectProvider }
)(CrossPostIssueControls);
