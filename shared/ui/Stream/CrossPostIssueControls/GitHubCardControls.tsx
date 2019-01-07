import * as React from "react";
import Icon from "../Icon";
import Menu from "../Menu";
import { Board, CrossPostIssueValuesListener, SUPPORTED_SERVICES } from "./types";

interface State {
	board: Board;
	isEnabled: boolean;
	boardMenuOpen: boolean;
	boardMenuTarget?: any;
}

interface Props {
	boards: Board[];
	onValues: CrossPostIssueValuesListener;
}

export default class GitHubCardControls extends React.Component<Props, State> {
	constructor(props) {
		super(props);
		const firstBoard = props.boards[0];
		this.state = {
			board: firstBoard,
			isEnabled: true,
			boardMenuOpen: false
		};
	}

	componentDidMount() {
		this.onValuesChanged();
	}

	onValuesChanged = () => {
		const { isEnabled, board } = this.state;
		this.props.onValues({
			boardId: board.name,
			isEnabled,
			service: SUPPORTED_SERVICES.GitHub.name
		});
	}

	switchBoard = event => {
		event.stopPropagation();
		this.setState({
			boardMenuOpen: !this.state.boardMenuOpen,
			boardMenuTarget: event.target
		});
	}

	selectBoard = board => {
		if (board) {
			this.setState({ board }, this.onValuesChanged);
		}
		this.setState({ boardMenuOpen: false });
	}

	toggleCrossPostIssue = () => {
		this.setState(state => ({ isEnabled: !state.isEnabled }), this.onValuesChanged);
	}

	render() {
		const { board } = this.state;
		const boardItems = this.props.boards.map(board => ({
			label: board.name,
			action: board
		}));

		return (
			<div className="checkbox-row" onClick={this.toggleCrossPostIssue}>
				<input type="checkbox" checked={this.state.isEnabled} />
				{"Create an issue on "}
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
				{` on ${SUPPORTED_SERVICES.GitHub.displayName}`}
			</div>
		);
	}
}
