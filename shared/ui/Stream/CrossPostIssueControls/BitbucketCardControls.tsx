import React from "react";
import Icon from "../Icon";
import Menu from "../Menu";
import { CrossPostIssueValuesListener, PROVIDER_MAPPINGS } from "./types";
import { ThirdPartyProviderBoard, ThirdPartyProviderInstance } from "@codestream/protocols/agent";

interface State {
	board?: ThirdPartyProviderBoard;
	isEnabled: boolean;
	boardMenuOpen: boolean;
	boardMenuTarget?: any;
}

interface Props {
	boards: ThirdPartyProviderBoard[];
	onValues: CrossPostIssueValuesListener;
	provider: ThirdPartyProviderInstance;
	codeBlock?: {
		source?: {
			repoPath: string;
		};
	};
}

export default class BitbucketCardControls extends React.Component<Props, State> {
	constructor(props) {
		super(props);
		const firstBoard = props.boards[0];
		this.state = {
			board: firstBoard,
			isEnabled: true,
			boardMenuOpen: false
		};
	}

	componentDidUpdate(prevProps: Props) {
		if (prevProps.codeBlock !== this.props.codeBlock) {
			this.selectBoardForCodeBlock();
		}
	}

	componentDidMount() {
		this.selectBoardForCodeBlock();
		this.onValuesChanged();
	}

	selectBoardForCodeBlock = () => {
		const { codeBlock } = this.props;
		for (const board of this.props.boards) {
			if (board.path === (codeBlock && codeBlock.source && codeBlock.source.repoPath)) {
				this.setState({ board }, this.onValuesChanged);
				break;
			}
		}
	};

	onValuesChanged = () => {
		const { isEnabled, board } = this.state;
		this.props.onValues({
			board,
			boardName: board && board.name,
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

	selectBoard = (board: ThirdPartyProviderBoard) => {
		if (board) {
			this.setState({ board }, this.onValuesChanged);
		}
		this.setState({ boardMenuOpen: false });
	};

	toggleCrossPostIssue = () => {
		this.setState(state => ({ isEnabled: !state.isEnabled }), this.onValuesChanged);
	};

	render() {
		const { board } = this.state;
		const { provider } = this.props;
		const boardItems = this.props.boards.map(board => ({
			label: board.name,
			action: board
		}));
		const providerDisplay = PROVIDER_MAPPINGS[provider.name];
		const displayName = provider.isEnterprise ?
			`${providerDisplay.displayName} - ${provider.host}` :
			providerDisplay.displayName;

		return (
			<div className="checkbox-row" onClick={this.toggleCrossPostIssue}>
				<input type="checkbox" checked={this.state.isEnabled} />
				{"Create an issue on "}
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
