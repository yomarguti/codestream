import React from "react";
import Icon from "../Icon";
import Menu from "../Menu";
import { Board, CrossPostIssueValuesListener, SUPPORTED_SERVICES } from "./types";

interface State {
	board?: Board;
	issueType?: string;
	issueTypeMenuOpen: boolean;
	issueTypeMenuTarget?: any;
	boardMenuOpen: boolean;
	boardMenuTarget?: any;
	isEnabled: boolean;
}

interface Props {
	boards: Board[];
	onValues: CrossPostIssueValuesListener;
}

export default class JiraCardControls extends React.Component<Props, State> {
	constructor(props) {
		super(props);
		const hasBoards = props.boards.length > 0;
		this.state = {
			board: hasBoards && props.boards[0],
			issueType: hasBoards && props.boards[0].issueTypes[0],
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
			provider: SUPPORTED_SERVICES.Jira.name
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
		const issueTypeItems = board ? board.issueTypes.map(it => ({ label: it, action: it })) : [];
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
				{` on ${SUPPORTED_SERVICES.Jira.displayName}`}
			</div>
		);
	}
}
