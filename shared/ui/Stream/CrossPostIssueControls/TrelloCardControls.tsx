import React from "react";
import ReactDOM from "react-dom";
import AsyncSelect from "react-select/async";
import Icon from "../Icon";
import Menu from "../Menu";
import {
	ThirdPartyProviderConfig,
	FetchThirdPartyBoardsRequestType,
	TrelloList,
	TrelloBoard,
	FetchAssignableUsersRequestType,
	FetchThirdPartyCardsRequestType,
	TrelloCard
} from "@codestream/protocols/agent";
import { useSelector, useDispatch } from "react-redux";
import { CodeStreamState } from "@codestream/webview/store";
import { getIntegrationData } from "@codestream/webview/store/activeIntegrations/reducer";
import { updateForProvider } from "@codestream/webview/store/activeIntegrations/actions";
import { emptyArray, mapFilter, keyFilter } from "@codestream/webview/utils";
import { HostApi } from "@codestream/webview/webview-api";
import { TrelloIntegrationData } from "@codestream/webview/store/activeIntegrations/types";
import { setIssueProvider } from "@codestream/webview/store/context/actions";
import { CrossPostIssueContext } from "../CodemarkForm";
import { useDidMount } from "@codestream/webview/utilities/hooks";
import { disconnectProvider } from "@codestream/webview/store/providers/actions";

interface Props {
	provider: ThirdPartyProviderConfig;
	q?: string;
	focusInput?: React.RefObject<HTMLInputElement>;
}

export function TrelloCardControls(props: React.PropsWithChildren<Props>) {
	const dispatch = useDispatch();
	const data = useSelector((state: CodeStreamState) =>
		getIntegrationData<TrelloIntegrationData>(state.activeIntegrations, props.provider.id)
	);
	const updateDataState = React.useCallback(
		(data: Partial<TrelloIntegrationData>) => {
			dispatch(updateForProvider<TrelloIntegrationData>(props.provider.id, data));
		},
		[props.provider.id]
	);

	useDidMount(() => {
		if (data.boards && data.boards.length > 0) {
			crossPostIssueContext.setValues({
				listId: data.currentList ? data.currentList.id : data.boards[0].lists[0].id
			});
			return;
		}

		if (!data.isLoading) {
			updateDataState({
				isLoading: true
			});
		}

		let isValid = true;

		const fetchBoards = async () => {
			const response = await HostApi.instance.send(FetchThirdPartyBoardsRequestType, {
				providerId: props.provider.id
			});

			if (!isValid) return;
			// make sure to persist current board/list selection if possible
			const newCurrentBoard = (data.currentBoard
				? response.boards.find(b => b.id === data.currentBoard!.id)
				: response.boards[0]) as TrelloBoard;

			const newCurrentList = (data.currentList
				? newCurrentBoard.lists.find(l => l.id === data.currentList!.id)
				: newCurrentBoard.lists[0]) as TrelloList;

			updateDataState({
				isLoading: false,
				boards: response.boards as TrelloBoard[],
				currentBoard: newCurrentBoard,
				currentList: newCurrentList
			});

			crossPostIssueContext.setValues({
				listId: newCurrentList.id
			});
		};

		fetchBoards();

		return () => {
			isValid = false;
		};
	});

	const [boardMenuState, setBoardMenuState] = React.useState<{
		open: boolean;
		target?: EventTarget;
	}>({ open: false, target: undefined });
	const [listMenuState, setListMenuState] = React.useState<{
		open: boolean;
		target?: EventTarget;
	}>({ open: false, target: undefined });

	const handleClickBoard = React.useCallback((event: React.MouseEvent) => {
		event.stopPropagation();
		const target = event.target;
		setBoardMenuState(state => ({
			open: !state.open,
			target
		}));
	}, []);

	const selectBoard = React.useCallback((board?: TrelloBoard) => {
		setBoardMenuState({ open: false });
		if (board) {
			updateDataState({
				currentBoard: board,
				currentList: board.lists[0]
			});
			crossPostIssueContext.setValues({
				listId: board.lists[0].id
			});
		}
	}, []);

	const handleClickList = React.useCallback((event: React.MouseEvent) => {
		event.stopPropagation();
		const target = event.target;
		setListMenuState(state => ({
			open: !state.open,
			target
		}));
	}, []);

	const selectList = React.useCallback((list?: TrelloList) => {
		setListMenuState({ open: false });

		if (list) {
			crossPostIssueContext.setValues({
				listId: list.id
			});
			updateDataState({
				currentList: list
			});
		}
	}, []);

	const loadAssignableUsers = React.useCallback(
		async (inputValue: string) => {
			if (!data.currentBoard) return [];

			const { users } = await HostApi.instance.send(FetchAssignableUsersRequestType, {
				providerId: props.provider.id,
				boardId: data.currentBoard!.id
			});
			return mapFilter(users, u => {
				if (u.displayName.toLowerCase().includes(inputValue.toLowerCase()))
					return { label: u.displayName, value: u };
				else return;
			});
		},
		[data.currentBoard]
	);

	const crossPostIssueContext = React.useContext(CrossPostIssueContext);

	const assigneesInput = (() => {
		if (crossPostIssueContext.assigneesInputTarget == undefined) return null;

		const { currentBoard } = data;

		return ReactDOM.createPortal(
			<AsyncSelect
				key={currentBoard ? currentBoard.id : "no-board"}
				id="input-assignees"
				name="assignees"
				classNamePrefix="react-select"
				defaultOptions
				loadOptions={loadAssignableUsers}
				value={crossPostIssueContext.selectedAssignees}
				isMulti
				placeholder="Members (optional)"
				getOptionValue={option => option.value.id}
				onChange={value => crossPostIssueContext.setSelectedAssignees(value)}
			/>,
			crossPostIssueContext.assigneesInputTarget
		);
	})();

	if (data.isLoading)
		return (
			<>
				{assigneesInput}
				<span>
					<Icon className="spin" name="sync" /> Fetching boards...
				</span>
				<a
					style={{ marginLeft: "5px" }}
					onClick={e => {
						e.preventDefault();
						dispatch(setIssueProvider(undefined));
						updateDataState({ isLoading: false });
					}}
				>
					cancel
				</a>
			</>
		);

	const boardItems = (data.boards || emptyArray).map(board => ({
		label: board.name,
		key: board.id,
		action: board
	}));
	const listItems = data.currentBoard
		? data.currentBoard.lists.map(list => ({
				label: list.name,
				key: list.id,
				action: list
		  }))
		: [];

	return (
		<>
			{assigneesInput}
			<div className="checkbox-row">
				<input type="checkbox" checked onChange={e => dispatch(setIssueProvider(undefined))} />
				{" Add a card on "}
				<span className="channel-label" onClick={handleClickBoard}>
					{data.currentBoard && data.currentBoard.name}
					<Icon name="chevron-down" />
					{boardMenuState.open && (
						<Menu
							align="center"
							compact={true}
							target={boardMenuState.target}
							items={boardItems}
							action={selectBoard}
						/>
					)}
				</span>
				{listItems.length > 0 && (
					<>
						{" in "}
						<span className="channel-label" onClick={handleClickList}>
							{data.currentList ? data.currentList.name : ""}
							<Icon name="chevron-down" />
							{listMenuState.open && (
								<Menu
									align="center"
									compact={true}
									target={listMenuState.target}
									items={listItems}
									action={selectList}
								/>
							)}
						</span>{" "}
					</>
				)}
				{` on `}
				{props.children}
			</div>
		</>
	);
}

export function TrelloCardDropdown(props: React.PropsWithChildren<Props>) {
	const dispatch = useDispatch();
	const data = useSelector((state: CodeStreamState) =>
		getIntegrationData<TrelloIntegrationData>(state.activeIntegrations, props.provider.id)
	);
	const updateDataState = React.useCallback(
		(data: Partial<TrelloIntegrationData>) => {
			dispatch(updateForProvider<TrelloIntegrationData>(props.provider.id, data));
		},
		[props.provider.id]
	);

	const buttonRef = React.useRef<HTMLElement>(null);

	useDidMount(() => {
		if (data.boards && data.boards.length > 0) {
			crossPostIssueContext.setValues({
				listId: data.currentList ? data.currentList.id : data.boards[0].lists[0].id
			});
			return;
		}

		if (!data.isLoading) {
			updateDataState({
				isLoading: true
			});
		}

		let isValid = true;

		const fetchBoards = async () => {
			const response = await HostApi.instance.send(FetchThirdPartyBoardsRequestType, {
				providerId: props.provider.id
			});

			if (!isValid) return;
			// make sure to persist current board/list selection if possible
			const newCurrentBoard = data.currentBoard
				? (response.boards.find(b => b.id === data.currentBoard!.id) as TrelloBoard)
				: undefined;

			const newCurrentList =
				newCurrentBoard && data.currentList
					? (newCurrentBoard.lists.find(l => l.id === data.currentList!.id) as TrelloList)
					: undefined;

			updateDataState({
				isLoading: false,
				boards: response.boards as TrelloBoard[],
				currentBoard: newCurrentBoard,
				currentList: newCurrentList
			});

			// crossPostIssueContext.setValues({
			// listId: newCurrentList.id
			// });
		};

		fetchBoards();

		return () => {
			isValid = false;
		};
	});

	React.useEffect(() => {
		void (async () => {
			if (!data.currentList) return;

			try {
				updateDataState({ isLoading: true });
				const response = await HostApi.instance.send(FetchThirdPartyCardsRequestType, {
					providerId: props.provider.id,
					listId: data.currentList.id
				});

				updateDataState({
					isLoading: false,
					cards: response.cards as TrelloCard[]
				});
			} catch (error) {
			} finally {
				updateDataState({ isLoading: false });
			}
		})();
	}, [data.currentList]);

	const [mode, setMode] = React.useState("mine");

	// reload "cards assigned to me"
	React.useEffect(() => {
		void (async () => {
			if (mode !== "mine") return;

			try {
				updateDataState({ isLoading: true });
				const response = await HostApi.instance.send(FetchThirdPartyCardsRequestType, {
					providerId: props.provider.id,
					assignedToMe: true
				});
				console.warn("CARDS: ", response.cards);
				updateDataState({
					isLoading: false,
					cards: response.cards as TrelloCard[]
				});
			} catch (error) {
			} finally {
				updateDataState({ isLoading: false });
			}
		})();
	}, [mode]);

	const [menuState, setMenuState] = React.useState<{
		open: boolean;
		target?: EventTarget;
	}>({ open: false, target: undefined });

	React.useEffect(() => {
		setMenuState(state => ({ open: props.q ? true : false }));
	}, [props.q]);

	const handleClickDropdown = React.useCallback((event: React.MouseEvent) => {
		if (data.isLoading) {
			event.preventDefault();
			dispatch(setIssueProvider(undefined));
			updateDataState({ isLoading: false });
		} else {
			event.stopPropagation();
			// @ts-ignore
			const target = event.target.closest(".dropdown-button");
			setMenuState(state => ({ open: !state.open }));
		}
	}, []);

	const selectCard = React.useCallback((card?: TrelloCard) => {
		if (card) {
			crossPostIssueContext.setValues({
				url: card.url,
				id: card.shortLink,
				title: card.name,
				description: card.desc,
				providerName: "trello"
			});
		}
		setMenuState({ open: false });
	}, []);

	const goMine = () => setMode("mine");
	const goBoard = () => setMode("board");
	const goSettings = () => setMode("settings");
	const goDisconnect = () => dispatch(disconnectProvider(props.provider.id, "Status Panel"));
	const noop = () => setMenuState({ open: false });

	const crossPostIssueContext = React.useContext(CrossPostIssueContext);

	const filterBoardItems = () => {
		const { filterBoards = {} } = data;
		const items = [] as any;
		if (!data.boards) return items;
		data.boards.forEach(board => {
			const b = board;
			const checked = !!filterBoards[board.id];
			items.push({
				label: board.name,
				key: board.id,
				checked,
				action: () => updateDataState({ filterBoards: { ...filterBoards, [b.id]: !checked } })
			});
		});
		return items;
	};

	const cardItems = React.useMemo(() => {
		if (!data.cards) return [];
		const isFiltering = keyFilter(data.filterBoards || {}).length > 0;

		const items = data.cards
			.filter(card => !isFiltering || data.filterBoards[card.idBoard])
			.filter(card => !props.q || card.name.includes(props.q))
			.map(card => ({
				label: card.name,
				searchLabel: card.name,
				icon: <Icon name="trello" />,
				key: card.id,
				action: card
			})) as any;
		// @ts-ignore
		// items.unshift({ label: "-" }, { type: "search" });
		const settingsItems = [
			{
				label: "Assignment",
				key: "mine",
				submenu: [
					{ label: "Cards Assigned to Me", key: "mine", checked: true },
					{ label: "All Cards", key: "all", checked: false }
				]
			},
			{ label: "Filter by Board", key: "board", submenu: filterBoardItems() },
			{ label: "-" },
			{
				label: "Disconnect Trello",
				key: "disconnect",
				action: goDisconnect,
				icon: <Icon name="x" />
			}
		];
		if (!props.q) {
			items.unshift(
				{
					label: "Filters & Settings",
					icon: <Icon name="gear" />,
					submenu: settingsItems
				},
				{ label: "-" }
			);
		}
		return items;
	}, [data.cards, data.boards, data.filterBoards, props.q]);

	return (
		<>
			<span
				className={`dropdown-button ${menuState.open ? "selected" : ""}`}
				onClick={handleClickDropdown}
				ref={buttonRef}
			>
				{data.isLoading ? <Icon className="spin" name="sync" /> : <Icon name="chevron-down" />}
			</span>
			{menuState.open && cardItems.length > 0 && (
				<Menu
					align="dropdownRight"
					target={buttonRef.current}
					items={cardItems}
					dontCloseOnSelect={true}
					action={selectCard}
					fullWidth={true}
					focusInput={props.focusInput}
				/>
			)}
		</>
	);
}
