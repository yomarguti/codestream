import React from "react";
import Icon from "../Icon";
import Menu from "../Menu";
import { CrossPostIssueValuesListener, PROVIDER_MAPPINGS, CodeDelimiterStyles } from "./types";
import { ThirdPartyProviderBoard, ThirdPartyProviderConfig } from "@codestream/protocols/agent";

interface State {
	board?: ThirdPartyProviderBoard;
	issueType?: string;
	issueTypeMenuOpen: boolean;
	issueTypeMenuTarget?: any;
	boardMenuOpen: boolean;
	boardMenuTarget?: any;
	isEnabled: boolean;
}

interface Props {
	boards: ThirdPartyProviderBoard[];
	onValues: CrossPostIssueValuesListener;
	provider: ThirdPartyProviderConfig;
}

export default class JiraCardControls extends React.Component<Props, State> {
	constructor(props) {
		super(props);
		const hasBoards = props.boards.length > 0;
		const firstBoard = hasBoards && props.boards[0];
		const issueType = firstBoard.issueTypes && firstBoard.issueTypes[0];
		this.state = {
			board: hasBoards && props.boards[0],
			issueType,
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
		this.props.onValues({
			board,
			boardId: board && board.id,
			issueType,
			isEnabled,
			issueProvider: this.props.provider,
			codeDelimiterStyle: CodeDelimiterStyles.CODE_BRACE
		});
	};

	switchIssueType = event => {
		event.stopPropagation();
		this.setState({
			issueTypeMenuOpen: !this.state.issueTypeMenuOpen,
			issueTypeMenuTarget: event.target
		});
	};

	selectIssueType = issueType => {
		if (issueType) {
			this.setState({ issueType }, this.onValuesChanged);
		}
		this.setState({ issueTypeMenuOpen: false });
	};

	switchBoard = event => {
		event.stopPropagation();
		this.setState({
			boardMenuOpen: !this.state.boardMenuOpen,
			boardMenuTarget: event.target
		});
	};

	selectBoard = board => {
		if (board) {
			this.setState({ board }, this.onValuesChanged);
		}
		this.setState({ boardMenuOpen: false });
	};

	toggleCrossPostIssue = () => {
		this.setState(state => ({ isEnabled: !state.isEnabled }), this.onValuesChanged);
	};

	render() {
		const { board, issueType } = this.state;
		const { provider } = this.props;
		const { host, name } = provider;
		const issueTypeItems = board ? board.issueTypes.map(it => ({ label: it, action: it })) : [];
		const boardItems = (this.props.boards || []).map(board => ({
			label: board.name,
			key: board.id,
			action: board
		}));
		const providerDisplay = PROVIDER_MAPPINGS[name];
		let displayName = providerDisplay.displayName;
		if (host && provider.isEnterprise) {
			const displayHost = host.startsWith('http://') ? host.split('http://')[1] :
				host.startsWith('https://') ? host.split('https://')[1] : host;
			displayName += ` - ${displayHost}`;
		}
		
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
					{board && board.name}
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
				{` on ${displayName}`}
			</div>
		);
	}
}
