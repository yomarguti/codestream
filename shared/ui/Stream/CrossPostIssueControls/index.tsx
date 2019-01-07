import * as React from "react";
import { connect } from "react-redux";
import { connectService, fetchIssueBoards } from "../actions";
import Icon from "../Icon";
import JiraCardControls from "./JiraCardControls";
import TrelloCardControls from "./TrelloCardControls";
import { Board, CrossPostIssueValuesListener, Service, SUPPORTED_SERVICES } from "./types";

interface Props {
	connectService: typeof connectService;
	fetchIssueBoards: typeof fetchIssueBoards;
	onValues: CrossPostIssueValuesListener;
	providerInfo?: {
		[service: string]: {};
	};
}

interface State {
	boards: Board[];
	isLoading: boolean;
	provider?: Service;
}

class CrossPostIssueControls extends React.Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = {
			boards: [],
			isLoading: false
		};
	}

	componentDidMount() {
		Object.values(SUPPORTED_SERVICES).forEach(service => {
			if (this.props.providerInfo && this.props.providerInfo[service.name]) {
				this.loadBoards(service);
			}
		});
	}

	componentDidUpdate(prevProps: Props, prevState: State) {
		const { providerInfo } = this.props;
		Object.values(SUPPORTED_SERVICES).forEach(service => {
			if (providerInfo) {
				if (
					providerInfo[service.name] &&
					!(prevProps.providerInfo && prevProps.providerInfo[service.name])
				) {
					this.loadBoards(service);
				}

				if (
					!providerInfo[service.name] &&
					prevProps.providerInfo &&
					prevProps.providerInfo[service.name]
				) {
					this.setState({ boards: [], provider: undefined, isLoading: false });
				}
			}
		});
	}

	async loadBoards(service: Service) {
		this.setState({ isLoading: true, provider: service });
		const response = await this.props.fetchIssueBoards(service.name);

		this.setState({
			isLoading: false,
			boards: response.boards,
			provider: service
		});
	}

	renderLoading() {
		const { provider } = this.state;

		return (
			<div className="checkbox-row connect-issue">
				<span>
					<Icon className="spin" name="sync" /> Syncing with {(provider as any).displayName}...
				</span>
			</div>
		);
	}

	renderProviderControls(provider: Service) {
		const { boards } = this.state;
		switch (provider.name) {
			case SUPPORTED_SERVICES.Jira.name: {
				return <JiraCardControls boards={boards} onValues={this.props.onValues} />;
			}
			case SUPPORTED_SERVICES.Trello.name: {
				return <TrelloCardControls boards={boards} onValues={this.props.onValues} />;
			}
			default:
				return "foobar";
		}
	}

	render() {
		if (this.state.isLoading) return this.renderLoading();
		else if (this.state.provider) return this.renderProviderControls(this.state.provider);
		else {
			return (
				<div className="checkbox-row connect-issue">
					Create an issue in{" "}
					{Object.values(SUPPORTED_SERVICES).map(service => (
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

	handleClickConnectIssueService(event: React.SyntheticEvent, service: Service): void {
		event.preventDefault();
		this.setState({ isLoading: true, provider: service });
		switch (service.name) {
			case "trello":
			case "asana":
			case "jira":
			case "github":
				this.props.connectService(service.name);
				break;
		}
	}
}

const mapStateToProps = state => {
	const { context, users, session } = state;
	const user = users[session.userId];
	return {
		providerInfo: user.providerInfo && user.providerInfo[context.currentTeamId]
	};
};

export default connect(
	mapStateToProps,
	{ connectService, fetchIssueBoards }
)(CrossPostIssueControls);
