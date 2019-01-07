import * as React from "react";
import { connect } from "react-redux";
import { connectService, fetchIssueBoards } from "./actions";
import Icon from "./Icon";
import Menu from "./Menu";

interface Service {
	name: string;
	displayName: string;
	icon?: string;
}

interface CardValues {
	service: string;
	[key: string]: any;
}
type CrossPostIssueValuesListener = (values: CardValues) => any;

const SUPPORTED_SERVICES: Service[] = [
	{ name: "trello", displayName: "Trello" },
	{ name: "jira", displayName: "Jira" },
	{ name: "github", icon: "mark-github", displayName: "GitHub" },
	{ name: "asana", displayName: "Asana" }
];

interface Props {
	connectService: typeof connectService;
	fetchIssueBoards: typeof fetchIssueBoards;
	onValues: CrossPostIssueValuesListener;
	providerInfo?: {
		[service: string]: {};
	};
}

interface Board {
	id: string;
	name: string;
	[key: string]: any;
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
		SUPPORTED_SERVICES.forEach(service => {
			if (this.props.providerInfo && this.props.providerInfo[service.name]) {
				this.loadBoards(service);
			}
		});
	}

	componentDidUpdate(prevProps: Props, prevState: State) {
		const { providerInfo } = this.props;
		SUPPORTED_SERVICES.forEach(service => {
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
			case "jira": {
				return <JiraCardControls boards={boards} onValues={this.props.onValues} />;
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
					{SUPPORTED_SERVICES.map(service => (
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

interface JiraCardControlsState {
	board: Board;
	issueType: string;
	issueTypeMenuOpen: boolean;
	issueTypeMenuTarget?: any;
	boardMenuOpen: boolean;
	boardMenuTarget?: any;
	isEnabled: boolean;
}

interface JiraControlsProps {
	boards: Board[];
	onValues: CrossPostIssueValuesListener;
}

class JiraCardControls extends React.Component<JiraControlsProps, JiraCardControlsState> {
	constructor(props) {
		super(props);
		this.state = {
			board: props.boards[0],
			issueType: props.boards[0].issueTypes[0],
			issueTypeMenuOpen: false,
			boardMenuOpen: false,
			isEnabled: true
		};
	}

	componentDidMount() {
		this.onValuesChanged();
	}

	onValuesChanged = () => {
		const { board, issueType, isEnabled } = this.state;
		this.props.onValues({ boardId: board.id, issueType, isEnabled, service: "jira" });
	}

	switchIssueType = event => {
		event.stopPropagation();
		this.setState({
			issueTypeMenuOpen: !this.state.issueTypeMenuOpen,
			issueTypeMenuTarget: event.target
		});
	}

	selectIssueType = issueType => {
		this.setState({ issueType });
		this.onValuesChanged();
	}

	switchBoard = event => {
		event.stopPropagation();
		this.setState({
			boardMenuOpen: !this.state.boardMenuOpen,
			boardMenuTarget: event.target
		});
	}

	selectBoard = board => {
		this.setState({ board });
		this.onValuesChanged();
	}

	toggleCrossPostIssue = () => {
		this.setState(state => ({ isEnabled: !state.isEnabled }));
		this.onValuesChanged();
	}

	render() {
		const { board, issueType } = this.state;
		const issueTypeItems = board.issueTypes.map(it => ({ label: it, action: it }));
		const boardItems = this.props.boards.map(board => ({
			label: board.name,
			action: board
		}));

		return (
			<div className="checkbox-row" onClick={this.toggleCrossPostIssue}>
				<input type="checkbox" checked={this.state.isEnabled} />
				{"Create a "}
				<span className="channel-label" onClick={this.switchIssueType}>
					{issueType}
					<Icon name="chevron-down" />
					{this.state.issueTypeMenuOpen && (
						<Menu
							align="center"
							compact={true}
							target={this.state.issueTypeMenuTarget}
							items={issueTypeItems}
							action={this.selectIssueType}
						/>
					)}
				</span>
				{" on "}
				<span className="channel-label" onClick={this.switchBoard}>
					{board.name}
					<Icon name="chevron-down" />
					{this.state.boardMenuOpen && (
						<Menu
							align="center"
							compact={true}
							target={this.state.boardMenuTarget}
							items={boardItems}
							action={this.selectBoard}
						/>
					)}
				</span>
				{" on Jira"}
			</div>
		);
	}
}
