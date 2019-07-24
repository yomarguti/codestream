import React from "react";
import Icon from "../Icon";
import Menu from "../Menu";
import { CrossPostIssueValuesListener, PROVIDER_MAPPINGS, CodeDelimiterStyles } from "./types";
import { ThirdPartyProviderBoard, ThirdPartyProviderConfig } from "@codestream/protocols/agent";

interface State {
	board?: ThirdPartyProviderBoard;
	//issueType?: string;
	//issueTypeMenuOpen: boolean;
	//issueTypeMenuTarget?: any;
	boardMenuOpen: boolean;
	boardMenuTarget?: any;
	isEnabled: boolean;
}

interface Props {
	boards: ThirdPartyProviderBoard[];
	onValues: CrossPostIssueValuesListener;
	provider: ThirdPartyProviderConfig;
}

export default class YouTrackCardControls extends React.Component<Props, State> {
	constructor(props) {
		super(props);
		const hasBoards = props.boards.length > 0;
		this.state = {
			board: hasBoards && props.boards[0],
			//issueType: hasBoards && props.boards[0].issueTypes[0],
			//issueTypeMenuOpen: false,
			boardMenuOpen: false,
			isEnabled: true
		};
	}

	componentDidMount() {
		this.onValuesChanged();
	}

	onValuesChanged = () => {
		const { board, /*issueType,*/ isEnabled } = this.state;
		this.props.onValues({
			board,
			boardId: board && board.id,
			//issueType,
			isEnabled,
			issueProvider: this.props.provider,
			codeDelimiterStyle: CodeDelimiterStyles.SINGLE_BACK_QUOTE
		});
	};

	/*
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
	*/

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
		const { board /*, issueType*/ } = this.state;
		const { provider } = this.props;
		//const issueTypeItems = board ? board.issueTypes.map(it => ({ label: it, action: it })) : [];
		const boardItems = this.props.boards.map(board => ({
			label: board.name,
			key: board.id,
			action: board
		}));
		const providerDisplay = PROVIDER_MAPPINGS[provider.name];
		const displayName =
			false && provider.isEnterprise
				? `${providerDisplay.displayName} - ${provider.host}`
				: providerDisplay.displayName;
		return (
			<div className="checkbox-row" onClick={this.toggleCrossPostIssue}>
				<input type="checkbox" checked={this.state.isEnabled} />
				{"Add an issue in "}
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
				{` on `}
				{this.props.children}
			</div>
		);
	}
}
