import React from "react";
import Icon from "../Icon";
import Menu from "../Menu";
import { CrossPostIssueValuesListener, PROVIDER_MAPPINGS } from "./types";
import { ThirdPartyProviderBoard, ThirdPartyProviderInstance } from "@codestream/protocols/agent";

interface List {
	id: string;
	name: string;
}

interface State {
	board: ThirdPartyProviderBoard;
	list?: List;
	isEnabled: boolean;
	boardMenuOpen: boolean;
	boardMenuTarget?: any;
	listMenuOpen: boolean;
	listMenuTarget?: any;
}

interface Props {
	boards: ThirdPartyProviderBoard[];
	onValues: CrossPostIssueValuesListener;
	provider: ThirdPartyProviderInstance;
}

export default class TrelloCardControls extends React.Component<Props, State> {
	constructor(props) {
		super(props);
		const firstBoard = props.boards[0];
		this.state = {
			board: firstBoard,
			list: firstBoard && firstBoard.lists[0],
			isEnabled: true,
			boardMenuOpen: false,
			listMenuOpen: false
		};
	}

	componentDidMount() {
		this.onValuesChanged();
	}

	onValuesChanged = () => {
		const { board, isEnabled, list } = this.state;
		this.props.onValues({
			board: board,
			listId: list && list.id,
			isEnabled,
			issueProvider: this.props.provider
		});
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
			this.setState({ board, list: board.lists[0] }, this.onValuesChanged);
		}
		this.setState({ boardMenuOpen: false });
	};

	switchList = event => {
		event.stopPropagation();
		this.setState({
			listMenuOpen: !this.state.listMenuOpen,
			listMenuTarget: event.target
		});
	};

	selectList = (list: List) => {
		this.setState({ listMenuOpen: false });
		if (list && list.id) {
			this.setState({ list }, this.onValuesChanged);
		}
	};

	toggleCrossPostIssue = () => {
		this.setState(state => ({ isEnabled: !state.isEnabled }), this.onValuesChanged);
	};

	render() {
		const { board, list } = this.state;
		const { provider } = this.props;
		const boardItems = this.props.boards.map(board => ({
			label: board.name,
			action: board
		}));
		const listItems = board
			? board.lists.map(list => ({
					label: list.name,
					action: list
			  }))
			: [];
		const providerDisplay = PROVIDER_MAPPINGS[provider.name];
		const displayName = provider.isEnterprise ?
			`${providerDisplay.displayName} - ${provider.host}` :
			providerDisplay.displayName;
	
		return (
			<div className="checkbox-row" onClick={this.toggleCrossPostIssue}>
				<input type="checkbox" checked={this.state.isEnabled} />
				{"Create a card on "}
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
				{listItems.length > 0 && [
					" in ",
					<span className="channel-label" onClick={this.switchList}>
						{list ? list.name : ""}
						<Icon name="chevron-down" />
						{this.state.listMenuOpen && (
							<Menu
								align="center"
								compact={true}
								target={this.state.listMenuTarget}
								items={listItems}
								action={this.selectList}
							/>
						)}
					</span>,
					" "
				]}
				{` on ${displayName}`}
			</div>
		);
	}
}
