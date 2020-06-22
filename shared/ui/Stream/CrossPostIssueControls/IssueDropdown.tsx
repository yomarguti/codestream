import React from "react";
import { connect, useDispatch, useSelector } from "react-redux";
import { connectProvider, getUserProviderInfo } from "../../store/providers/actions";
import { openPanel, setIssueProvider } from "../../store/context/actions";
import Icon from "../Icon";
import Menu from "../Menu";
import { ProviderDisplay, PROVIDER_MAPPINGS } from "./types";
import {
	ThirdPartyProviderConfig,
	ThirdPartyProviders,
	FetchThirdPartyBoardsRequestType,
	TrelloBoard,
	TrelloList,
	FetchThirdPartyCardsRequestType,
	ThirdPartyProviderCard,
	TrelloCard
} from "@codestream/protocols/agent";
import { CSMe } from "@codestream/protocols/api";
import { PrePRProviderInfoModalProps, PrePRProviderInfoModal } from "../PrePRProviderInfoModal";
import { CodeStreamState } from "@codestream/webview/store";
import { getConnectedProviderNames } from "@codestream/webview/store/providers/reducer";
import { updateForProvider } from "@codestream/webview/store/activeIntegrations/actions";
import { getIntegrationData } from "@codestream/webview/store/activeIntegrations/reducer";
import {
	TrelloIntegrationData,
	ActiveIntegrationData
} from "@codestream/webview/store/activeIntegrations/types";
import { setUserPreference } from "../actions";
import { useDidMount } from "@codestream/webview/utilities/hooks";
import { HostApi } from "../..";
import { keyFilter } from "@codestream/webview/utils";
import { StartWorkIssueContext } from "../StatusPanel";
import { PreferencesActionsType } from "@codestream/webview/store/preferences/types";

interface ProviderInfo {
	provider: ThirdPartyProviderConfig;
	display: ProviderDisplay;
}

interface ConnectedProps {
	connectedProviderNames: string[];
	currentTeamId: string;
	currentUser: CSMe;
	issueProviderConfig?: ThirdPartyProviderConfig;
	providers: ThirdPartyProviders;
	disabledProviders: { [key: string]: boolean };
	setUserPreference?: Function;
}

interface Props extends ConnectedProps {
	connectProvider(...args: Parameters<typeof connectProvider>): any;
	updateForProvider(...args: Parameters<typeof updateForProvider>): any;
	setIssueProvider(providerId?: string): void;
	openPanel(...args: Parameters<typeof openPanel>): void;
	isEditing?: boolean;
	q?: string;
	focusInput?: React.RefObject<HTMLInputElement>;
}

interface State {
	isLoading: boolean;
	loadingProvider?: ProviderInfo;
	issueProviderMenuOpen: boolean;
	issueProviderMenuTarget: any;
	propsForPrePRProviderInfoModal?: PrePRProviderInfoModalProps;
}

class IssueDropdown extends React.Component<Props, State> {
	constructor(props: Props) {
		super(props);
		const providerInfo = props.issueProviderConfig
			? this.getProviderInfo(props.issueProviderConfig.id)
			: undefined;
		const loadingProvider = providerInfo;
		this.state = {
			isLoading: false,
			loadingProvider,
			issueProviderMenuOpen: false,
			issueProviderMenuTarget: undefined
		};
	}

	componentDidMount() {
		const { issueProviderConfig } = this.props;
		const providerInfo = issueProviderConfig
			? this.getProviderInfo(issueProviderConfig.id)
			: undefined;
		if (!issueProviderConfig || !providerInfo) {
			this.props.setIssueProvider(undefined);
		}
	}

	componentDidUpdate(prevProps: Props, prevState: State) {
		const { issueProviderConfig } = this.props;
		const providerInfo = issueProviderConfig
			? this.getProviderInfo(issueProviderConfig.id)
			: undefined;
		if (
			providerInfo &&
			issueProviderConfig &&
			(!prevProps.issueProviderConfig ||
				prevProps.issueProviderConfig.id !== issueProviderConfig.id)
		) {
			this.setState({ isLoading: false });
		} else if (!providerInfo && prevProps.issueProviderConfig) {
			if (this.state.isLoading) {
				this.setState({ isLoading: false, loadingProvider: undefined });
			}
		}
	}

	renderLoading() {
		return (
			<span className="dropdown-button" onClick={this.cancelLoading}>
				<Icon className="spin" name="sync" />
			</span>
		);
	}

	cancelLoading = () => {
		this.setState({ isLoading: false });
		this.props.setIssueProvider(undefined);
	};

	render() {
		const { issueProviderConfig } = this.props;
		const providerInfo = issueProviderConfig
			? this.getProviderInfo(issueProviderConfig.id)
			: undefined;

		if (this.state.isLoading) return this.renderLoading();

		if (!this.props.providers || !Object.keys(this.props.providers).length) return null;

		const knownIssueProviders = Object.keys(this.props.providers).filter(providerId => {
			const provider = this.props.providers![providerId];
			return provider.hasIssues && !!PROVIDER_MAPPINGS[provider.name];
		});
		if (knownIssueProviders.length === 0) {
			return null;
		}

		const selectedProviderId = providerInfo && providerInfo.provider.id;
		const knownIssueProviderOptions = knownIssueProviders
			.map(providerId => {
				const issueProvider = this.props.providers![providerId];
				const providerDisplay = PROVIDER_MAPPINGS[issueProvider.name];
				const displayName = issueProvider.isEnterprise
					? `${providerDisplay.displayName} - ${issueProvider.host}`
					: providerDisplay.displayName;
				const supported = providerDisplay.supportsStartWork;
				return {
					// icon: <Icon name={providerDisplay.icon || "blank"} />,
					checked: this.providerIsConnected(providerId) && !this.providerIsDisabled(providerId),
					value: providerId,
					label: displayName + (supported ? "" : " (soon!)"),
					disabled: !supported,
					key: providerId,
					action: () => this.selectIssueProvider(providerId)
				};
			})
			.sort((a, b) =>
				a.disabled === b.disabled ? a.label.localeCompare(b.label) : a.disabled ? 1 : -1
			);
		const index = knownIssueProviderOptions.findIndex(i => i.disabled);
		// @ts-ignore
		knownIssueProviderOptions.splice(index, 0, { label: "-" });

		const activeProviders = knownIssueProviders
			.filter(id => this.providerIsConnected(id) && !this.providerIsDisabled(id))
			.map(id => this.props.providers![id]);

		const { q, focusInput } = this.props;

		return (
			<>
				{this.state.propsForPrePRProviderInfoModal && (
					<PrePRProviderInfoModal {...this.state.propsForPrePRProviderInfoModal} />
				)}
				<CardDropdown
					providers={activeProviders}
					q={q}
					focusInput={focusInput}
					knownIssueProviderOptions={knownIssueProviderOptions}
				></CardDropdown>
			</>
		);
	}

	renderProviderOptions = (selectedProvider, knownIssueProviderOptions) => {
		return (
			<span className="dropdown-button" onClick={this.switchIssueProvider}>
				<Icon name="chevron-down" />
				{this.state.issueProviderMenuOpen && (
					<Menu
						align="dropdownRight"
						target={this.state.issueProviderMenuTarget}
						items={knownIssueProviderOptions}
						action={() => {}}
					/>
				)}
			</span>
		);
	};

	switchIssueProvider = (event: React.SyntheticEvent) => {
		if (this.props.isEditing) return;

		event.stopPropagation();
		const target = event.target;
		this.setState(state => ({
			issueProviderMenuOpen: !state.issueProviderMenuOpen,
			// @ts-ignore
			issueProviderMenuTarget: target.closest(".dropdown-button")
		}));
	};

	providerIsDisabled = providerId => this.props.disabledProviders[providerId];

	selectIssueProvider = providerId => {
		const { setUserPreference } = this.props;
		this.setState({ issueProviderMenuOpen: false });
		if (!providerId) return;
		if (providerId === "codestream") {
			this.props.setIssueProvider(undefined);
			return;
		}

		if (this.providerIsDisabled(providerId)) {
			// if it's disabled, enable it
			if (setUserPreference)
				setUserPreference(["startWork", "disabledProviders", providerId], false);
		} else if (this.providerIsConnected(providerId)) {
			// if it's conected and not disabled, disable it
			if (setUserPreference)
				setUserPreference(["startWork", "disabledProviders", providerId], true);
		} else {
			// otherwise we need to connect
			const issueProvider = this.props.providers![providerId];
			const providerDisplay = PROVIDER_MAPPINGS[issueProvider.name];
			this.onChangeProvider({ provider: issueProvider, display: providerDisplay });
		}
	};

	async onChangeProvider(providerInfo: ProviderInfo) {
		if (
			providerInfo.provider.needsConfigure &&
			!this.providerIsConnected(providerInfo.provider.id)
		) {
			const { name, id } = providerInfo.provider;
			this.props.openPanel(`configure-provider-${name}-${id}-Compose Modal`);
		} else if (
			providerInfo.provider.forEnterprise &&
			!this.providerIsConnected(providerInfo.provider.id)
		) {
			const { name, id } = providerInfo.provider;
			/* if (name === "github_enterprise") {
				this.setState({
					propsForPrePRProviderInfoModal: {
						providerName: name,
						onClose: () => this.setState({ propsForPrePRProviderInfoModal: undefined }),
						action: () => this.props.openPanel(`configure-enterprise-${name}-${id}`)
					}
				});
			} else */ this.props.openPanel(
				`configure-enterprise-${name}-${id}-Compose Modal`
			);
		} else {
			const { name } = providerInfo.provider;
			const { connectedProviderNames, issueProviderConfig } = this.props;
			const newValueIsNotCurrentProvider =
				issueProviderConfig == undefined || issueProviderConfig.name !== name;
			const newValueIsNotAlreadyConnected = !connectedProviderNames.includes(name);
			if (
				newValueIsNotCurrentProvider &&
				newValueIsNotAlreadyConnected &&
				(name === "github" || name === "bitbucket" || name === "gitlab")
			) {
				this.setState({
					propsForPrePRProviderInfoModal: {
						providerName: name,
						onClose: () => {
							this.setState({ propsForPrePRProviderInfoModal: undefined });
						},
						action: () => {
							this.setState({ isLoading: true, loadingProvider: providerInfo });
							this.props.connectProvider(providerInfo.provider.id, "Status Panel");
						}
					}
				});
			} else {
				this.setState({ isLoading: true, loadingProvider: providerInfo });
				const ret = await this.props.connectProvider(providerInfo.provider.id, "Status Panel");
				if (ret && ret.alreadyConnected) this.setState({ isLoading: false });
			}
		}
	}

	getProviderInfo(providerId: string): ProviderInfo | undefined {
		const provider = this.props.providers ? this.props.providers[providerId] : undefined;
		if (!provider) return undefined;
		const display = provider ? PROVIDER_MAPPINGS[provider.name] : undefined;
		if (!display) return undefined;
		let providerInfo = getUserProviderInfo(
			this.props.currentUser,
			provider.name,
			this.props.currentTeamId
		);
		if (!providerInfo) return undefined;
		if (provider.isEnterprise) {
			if (!providerInfo.hosts) return undefined;
			providerInfo = providerInfo.hosts[provider.id];
		}
		if (!providerInfo.accessToken) return undefined;
		return { provider, display };
	}

	providerIsConnected(providerId: string): boolean {
		const provider = this.props.providers ? this.props.providers[providerId] : undefined;
		const { currentUser } = this.props;
		if (!provider || currentUser.providerInfo == undefined) return false;
		let providerInfo = currentUser.providerInfo[this.props.currentTeamId][provider.name];
		if (!providerInfo) return false;
		if (providerInfo.accessToken) return true;
		if (!provider.isEnterprise) return false;
		if (!providerInfo!.hosts) return false;
		providerInfo = providerInfo!.hosts![provider.id];
		return providerInfo && !!providerInfo.accessToken;
	}
}

const mapStateToProps = (state: CodeStreamState): ConnectedProps => {
	const { users, session, context, providers, preferences } = state;
	const currentIssueProviderConfig = context.issueProvider
		? providers[context.issueProvider]
		: undefined;

	const workPreferences = preferences.startWork || {};

	return {
		currentUser: users[session.userId!] as CSMe,
		currentTeamId: context.currentTeamId,
		providers,
		issueProviderConfig: currentIssueProviderConfig,
		connectedProviderNames: getConnectedProviderNames(state),
		disabledProviders: workPreferences.disabledProviders || {}
	};
};

export default connect(mapStateToProps, {
	connectProvider,
	setIssueProvider,
	openPanel,
	updateForProvider,
	setUserPreference
})(IssueDropdown);

interface DropdownProps {
	providers: ThirdPartyProviderConfig[];
	q?: string;
	focusInput?: React.RefObject<HTMLInputElement>;
	knownIssueProviderOptions: any;
}

const EMPTY_ARRAY = {};

export function CardDropdown(props: React.PropsWithChildren<DropdownProps>) {
	const dispatch = useDispatch();
	const data = useSelector((state: CodeStreamState) => state.activeIntegrations);
	const derivedState = useSelector((state: CodeStreamState) => {
		const { preferences = {} } = state;
		const currentUser = state.users[state.session.userId!] as CSMe;
		const startWorkPreferences = preferences.startWork || EMPTY_ARRAY;
		const providerIds = props.providers.map(provider => provider.id).join(":");
		return { currentUser, startWorkPreferences, providerIds };
	});

	const [isLoading, setIsLoading] = React.useState(false);
	const [loadedBoards, setLoadedBoards] = React.useState(0);
	const [loadedCards, setLoadedCards] = React.useState(0);
	const [menuState, setMenuState] = React.useState<{
		open: boolean;
		target?: EventTarget;
	}>({ open: false, target: undefined });

	React.useEffect(() => {
		setMenuState(state => ({ open: props.q ? true : false }));
	}, [props.q]);

	const getFilterLists = providerId => {
		const prefs = derivedState.startWorkPreferences[providerId] || {};
		return prefs.filterLists || EMPTY_ARRAY;
	};

	const getFilterBoards = providerId => {
		const prefs = derivedState.startWorkPreferences[providerId] || {};
		return prefs.filterBoards || EMPTY_ARRAY;
	};

	const getFilterAssignees = providerId => {
		const prefs = derivedState.startWorkPreferences[providerId] || {};
		return prefs.filterAssignees || "mine";
	};

	const updateDataState = (providerId, data) => dispatch(updateForProvider(providerId, data));

	const buttonRef = React.useRef<HTMLElement>(null);

	const setPreference = (providerId, key, value) => {
		dispatch(setUserPreference(["startWork", providerId, key], value));
	};

	React.useEffect(() => {
		// if (data.boards && data.boards.length > 0) return;

		if (!isLoading) setIsLoading(true);

		let isValid = true;

		const fetchBoards = async () => {
			if (!isValid) return;

			await Promise.all(
				props.providers.map(async provider => {
					const response = await HostApi.instance.send(FetchThirdPartyBoardsRequestType, {
						providerId: provider.id
					});
					updateDataState(provider.id, { boards: response.boards });
				})
			);
			setLoadedBoards(loadedBoards + 1);
		};

		fetchBoards();

		return () => {
			isValid = false;
		};
	}, [derivedState.providerIds]);

	React.useEffect(() => {
		void (async () => {
			setIsLoading(true);
			await Promise.all(
				props.providers.map(async provider => {
					const boardIds = keyFilter(getFilterBoards(provider.id));
					try {
						// only allow to filter by all if you've selected boards to filter by
						const filterAssigneesSetting =
							getFilterAssignees(provider.id) === "all" &&
							keyFilter(getFilterLists(provider.id)).length > 0
								? "all"
								: "mine";
						const response = await HostApi.instance.send(FetchThirdPartyCardsRequestType, {
							providerId: provider.id,
							data: {
								assignedToMe: filterAssigneesSetting === "mine",
								assignedToAnyone: filterAssigneesSetting === "all",
								filterBoards: keyFilter(getFilterBoards(provider.id)),
								filterLists: keyFilter(getFilterLists(provider.id))
							}
						});
						updateDataState(provider.id, {
							cards: response.cards
						});
					} catch (error) {
						console.warn("Error Loading Cards: ", error);
					} finally {
					}
				})
			);

			setIsLoading(false);
			setLoadedCards(loadedCards + 1);
		})();
	}, [loadedBoards, derivedState.startWorkPreferences]);

	const handleClickDropdown = React.useCallback((event: React.MouseEvent) => {
		if (isLoading) {
			event.preventDefault();
			dispatch(setIssueProvider(undefined));
			setIsLoading(false);
		} else {
			event.stopPropagation();
			// @ts-ignore
			const target = event.target.closest(".dropdown-button");
			setMenuState(state => ({ open: !state.open }));
		}
	}, []);

	const selectCard = React.useCallback(
		(card?: ThirdPartyProviderCard) => {
			if (card) {
				const { provider } = card;
				const providerDisplay = PROVIDER_MAPPINGS[provider.name];
				const pData = data[provider.id] || {};
				// @ts-ignore
				const board = pData.boards && pData.boards.find(b => b.id === card.idBoard);
				const lists = board && board.lists;
				startWorkIssueContext.setValues({
					...card,
					providerIcon: providerDisplay.icon,
					providerName: providerDisplay.displayName,
					providerId: provider.id,
					moveCardLabel: `Move this ${providerDisplay.cardLabel} to`,
					moveCardOptions: lists
				});
			}
			setMenuState({ open: false });
		},
		[data.boards]
	);

	const startWorkIssueContext = React.useContext(StartWorkIssueContext);

	// https://stackoverflow.com/questions/3446170/escape-string-for-use-in-javascript-regex
	const escapeRegExp = string => string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
	const queryRegexp = React.useMemo(() => new RegExp(escapeRegExp(props.q), "gi"), [props.q]);

	const underlineQ = string => (
		<span dangerouslySetInnerHTML={{ __html: string.replace(queryRegexp, "<u><b>$&</b></u>") }} />
	);

	const filterBoardItems = provider => {
		const filterLists = getFilterLists(provider.id);
		const filterBoards = getFilterBoards(provider.id);
		const items = [] as any;
		const pData = data[provider.id] || {};
		// @ts-ignore
		if (!pData.boards) return items;
		// @ts-ignore
		pData.boards.forEach(board => {
			const b = board;
			let boardChecked = false;
			const lists = board.lists;
			if (lists) {
				const submenu = board.lists.map(list => {
					const l = list;
					const checked = !!filterLists[list.id];
					if (checked) boardChecked = true;
					return {
						label: list.name,
						key: list.id,
						checked,
						action: () =>
							setPreference(provider.id, "filterLists", { ...filterLists, [l.id]: !checked })
					};
				});
				items.push({
					label: board.name,
					key: board.id,
					checked: boardChecked,
					action: () => {},
					submenu
				});
			} else {
				const checked = !!filterBoards[b.id];
				items.push({
					label: board.name,
					key: board.id,
					checked,
					action: () =>
						setPreference(provider.id, "filterBoards", { ...filterBoards, [b.id]: !checked })
				});
			}
		});
		return items;
	};

	const filterByBoardList = provider => {
		const providerDisplay = PROVIDER_MAPPINGS[provider.name];
		return {
			label: `Filter ${providerDisplay.displayName} by ${providerDisplay.boardLabelCaps} & ${providerDisplay.listLabelCaps}`,
			icon: <Icon name={providerDisplay.icon} />,
			key: "filters-" + provider.name,
			submenu: filterBoardItems(provider)
		};
	};

	const cardItems = React.useMemo(() => {
		const items = [] as any;
		const lowerQ = (props.q || "").toLocaleLowerCase();
		props.providers.forEach(provider => {
			const filterLists = getFilterLists(provider.id);
			const isFiltering = keyFilter(filterLists).length > 0;
			const providerDisplay = PROVIDER_MAPPINGS[provider.name];

			const pData = data[provider.id] || {};
			// @ts-ignore
			const cards = pData.cards || [];
			items.push(
				...(cards
					// @ts-ignore
					.filter(card => !isFiltering || filterLists[card.idList])
					.filter(card => !props.q || card.title.toLocaleLowerCase().includes(lowerQ))
					.map(card => ({
						label: props.q ? underlineQ(card.title) : card.title,
						searchLabel: card.title,
						icon: providerDisplay.icon && <Icon name={providerDisplay.icon} />,
						key: "card-" + card.id,
						modifiedAt: card.modifiedAt,
						action: { ...card, provider }
					})) as any)
			);
		});

		items.sort((a, b) => b.modifiedAt - a.modifiedAt);

		if (!props.q) {
			items.unshift({ label: "-" });
			// if (props.provider.canFilterByAssignees) {
			// 	items.unshift({
			// 		label: "Filter by Assignee",
			// 		icon: <Icon name="filter" />,
			// 		key: "assignment",
			// 		submenu: [
			// 			{
			// 				label: `${derivedState.providerDisplay.cardLabel} Assigned to Me`,
			// 				key: "mine",
			// 				checked: derivedState.filterAssignees === "mine",
			// 				action: () => setPreference("filterAssignees", "mine")
			// 			},
			// 			{
			// 				label: `Unassigned ${derivedState.providerDisplay.cardLabel}`,
			// 				key: "unassigned",
			// 				checked: derivedState.filterAssignees === "unassigned",
			// 				action: () => setPreference("filterAssignees", "unassigned")
			// 			},
			// 			{
			// 				label: `All ${derivedState.providerDisplay.cardLabel}`,
			// 				key: "all",
			// 				checked: derivedState.filterAssignees === "all",
			// 				action: () => setPreference("filterAssignees", "all")
			// 			}
			// 		]
			// 	});
			// }
			// const submenu = [] as any;
			// props.providers.forEach(provider => {
			// 	submenu.push(filterByBoardList(provider));
			// });
			// submenu.push(
			// 	{ label: "-" },
			// 	{
			// 		label: "Connect another Service",
			// 		key: "connect",
			// 		submenu: props.knownIssueProviderOptions
			// 	}
			// );

			props.providers.forEach(provider => {
				const providerDisplay = PROVIDER_MAPPINGS[provider.name];
				if (providerDisplay.hasFilters) items.unshift(filterByBoardList(provider));
			});
			items.unshift({
				label: `Connected Services`,
				icon: <Icon name="gear" />,
				key: "settings",
				submenu: props.knownIssueProviderOptions
			});
		}
		return items;
	}, [loadedCards, derivedState.startWorkPreferences, props.q]);

	return (
		<span
			className={`dropdown-button ${menuState.open ? "selected" : ""}`}
			onClick={handleClickDropdown}
			ref={buttonRef}
		>
			{isLoading ? <Icon className="spin" name="sync" /> : <Icon name="chevron-down" />}
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
		</span>
	);
}
