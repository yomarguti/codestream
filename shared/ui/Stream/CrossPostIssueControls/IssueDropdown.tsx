import React from "react";
import { connect, useDispatch, useSelector } from "react-redux";
import { connectProvider, getUserProviderInfo } from "../../store/providers/actions";
import {
	openPanel,
	setIssueProvider,
	setCodemarkTypeFilter,
	setCurrentCodemark
} from "../../store/context/actions";
import Icon from "../Icon";
import Menu from "../Menu";
import { ProviderDisplay, PROVIDER_MAPPINGS } from "./types";
import {
	ThirdPartyProviderConfig,
	ThirdPartyProviders,
	FetchThirdPartyBoardsRequestType,
	FetchThirdPartyCardsRequestType,
	OpenUrlRequestType,
	CodemarkPlus
} from "@codestream/protocols/agent";
import { CSMe, CodemarkType, CodemarkStatus } from "@codestream/protocols/api";
import { PrePRProviderInfoModalProps, PrePRProviderInfoModal } from "../PrePRProviderInfoModal";
import { CodeStreamState } from "@codestream/webview/store";
import { getConnectedProviderNames } from "@codestream/webview/store/providers/reducer";
import { updateForProvider } from "@codestream/webview/store/activeIntegrations/actions";
import { setUserPreference } from "../actions";
import { HostApi } from "../..";
import { keyFilter } from "@codestream/webview/utils";
import {
	StartWorkIssueContext,
	RoundedLink,
	H4,
	StatusSection,
	WideStatusSection,
	EMPTY_STATUS
} from "../StatusPanel";
import styled from "styled-components";
import Filter from "../Filter";
import { SmartFormattedList } from "../SmartFormattedList";
import { Provider, IntegrationButtons } from "../IntegrationsPanel";
import { LoadingMessage } from "@codestream/webview/src/components/LoadingMessage";
import Tooltip from "../Tooltip";
import { Headshot } from "@codestream/webview/src/components/Headshot";
import * as codemarkSelectors from "../../store/codemarks/reducer";
import { useDidMount } from "@codestream/webview/utilities/hooks";
import Timestamp from "../Timestamp";

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
	selectedCardId: string;
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
					providerIcon: <Icon name={providerDisplay.icon || "blank"} />,
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
		// const index = knownIssueProviderOptions.findIndex(i => i.disabled);
		// @ts-ignore
		// knownIssueProviderOptions.splice(index, 0, { label: "-" });

		const activeProviders = knownIssueProviders
			.filter(id => this.providerIsConnected(id) && !this.providerIsDisabled(id))
			.map(id => this.props.providers![id]);

		return (
			<>
				{this.state.propsForPrePRProviderInfoModal && (
					<PrePRProviderInfoModal {...this.state.propsForPrePRProviderInfoModal} />
				)}
				<IssueList
					providers={activeProviders}
					knownIssueProviderOptions={knownIssueProviderOptions}
					selectedCardId={this.props.selectedCardId}
				></IssueList>
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

		// if (setUserPreference) setUserPreference(["skipConnectIssueProviders"], false);

		if (this.providerIsDisabled(providerId)) {
			// if it's disabled, enable it
			if (setUserPreference)
				setUserPreference(["startWork", "disabledProviders", providerId], false);
		} else if (this.providerIsConnected(providerId)) {
			// if it's conected and not disabled, disable it
			if (setUserPreference) {
				setUserPreference(["startWork", "disabledProviders", providerId], true);
				// setUserPreference(["skipConnectIssueProviders"], false);
			}
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
							this.props.connectProvider(providerInfo.provider.id, "Status");
						}
					}
				});
			} else {
				this.setState({ isLoading: true, loadingProvider: providerInfo });
				const ret = await this.props.connectProvider(providerInfo.provider.id, "Status");
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

export function Issue(props) {
	const { card } = props;
	return (
		<div onClick={props.onClick} style={{ padding: "2px 0" }}>
			{card.icon}
			{card.label}
		</div>
	);
}

interface IssueListProps {
	providers: ThirdPartyProviderConfig[];
	knownIssueProviderOptions: any;
	selectedCardId: string;
}

const EMPTY_ARRAY = {};

export function IssueList(props: React.PropsWithChildren<IssueListProps>) {
	const dispatch = useDispatch();
	const data = useSelector((state: CodeStreamState) => state.activeIntegrations);
	const derivedState = useSelector((state: CodeStreamState) => {
		const { preferences = {} } = state;
		const currentUser = state.users[state.session.userId!] as CSMe;
		const startWorkPreferences = preferences.startWork || EMPTY_ARRAY;
		const providerIds = props.providers.map(provider => provider.id).join(":");
		const skipConnect = preferences.skipConnectIssueProviders;

		const csIssues = codemarkSelectors.getMyOpenIssues(state.codemarks, state.session.userId!);
		let status =
			currentUser.status && "label" in currentUser.status ? currentUser.status : EMPTY_STATUS;

		return { status, currentUser, startWorkPreferences, providerIds, csIssues, skipConnect };
	});

	const [isLoading, setIsLoading] = React.useState(false);
	const [loadedBoards, setLoadedBoards] = React.useState(0);
	const [loadedCards, setLoadedCards] = React.useState(0);

	const getFilterLists = (providerId: string) => {
		const prefs = derivedState.startWorkPreferences[providerId] || {};
		const lists = prefs.filterLists ? { ...prefs.filterLists } : EMPTY_ARRAY;
		return lists;
	};

	const getFilterBoards = (providerId: string) => {
		const prefs = derivedState.startWorkPreferences[providerId] || {};
		const boards = prefs.filterBoards ? { ...prefs.filterBoards } : EMPTY_ARRAY;
		return boards;
	};

	const codemarkState = useSelector((state: CodeStreamState) => state.codemarks);

	useDidMount(() => {
		if (!codemarkState.bootstrapped) {
			// dispatch(bootstrapCodemarks());
		}
	});

	const updateDataState = (providerId, data) => dispatch(updateForProvider(providerId, data));

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
			if (!loadedBoards) return;

			setIsLoading(true);

			await Promise.all(
				props.providers.map(async provider => {
					try {
						const response = await HostApi.instance.send(FetchThirdPartyCardsRequestType, {
							providerId: provider.id
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
	}, [loadedBoards]);

	const selectCard = React.useCallback(
		(card?) => {
			if (card) {
				const { provider } = card;
				if (provider) {
					const providerDisplay = PROVIDER_MAPPINGS[provider.name];
					const pData = data[provider.id] || {};
					// @ts-ignore
					const board = pData.boards && pData.boards.find(b => b.id === card.idBoard);
					const lists = board && board.lists;
					// console.warn("SETTINGS VALUES: ", pData, card);
					startWorkIssueContext.setValues({
						...card,
						providerIcon: provider.id === "codestream" ? "issue" : providerDisplay.icon,
						providerToken: providerDisplay.icon,
						providerName: providerDisplay.displayName,
						providerId: provider.id,
						moveCardLabel: `Move this ${providerDisplay.cardLabel} to`,
						moveCardOptions: lists
					});
				} else {
					// creating a new card/issue
					startWorkIssueContext.setValues({ ...card });
				}
			} else {
				startWorkIssueContext.setValues(undefined);
			}
		},
		[loadedBoards, loadedCards]
	);

	const startWorkIssueContext = React.useContext(StartWorkIssueContext);

	// // https://stackoverflow.com/questions/3446170/escape-string-for-use-in-javascript-regex
	// const escapeRegExp = string => string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
	// const queryRegexp = React.useMemo(() => new RegExp(escapeRegExp(props.q), "gi"), [props.q]);

	// const underlineQ = string => (
	// 	<span dangerouslySetInnerHTML={{ __html: string.replace(queryRegexp, "<u><b>$&</b></u>") }} />
	// );

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
					const checked = !!filterLists[list.id || "_"];
					if (checked) boardChecked = true;
					return {
						label: list.name,
						key: list.id,
						checked,
						action: () =>
							setPreference(provider.id, "filterLists", { ...filterLists, [l.id || "_"]: !checked })
					};
				});
				items.push({
					label: board.name,
					key: "board-" + board.id,
					checked: boardChecked,
					action: () => {},
					submenu
				});
			} else {
				const checked = !!filterBoards[b.id];
				console.warn("GOT: ", checked, " from ", b, " and ", filterBoards);
				items.push({
					label: board.name,
					key: "board-" + board.id,
					checked,
					action: () =>
						setPreference(provider.id, "filterBoards", { ...filterBoards, [b.id || "_"]: !checked })
				});
			}
		});
		return items;
	};

	const filterByBoardList = provider => {
		const providerDisplay = PROVIDER_MAPPINGS[provider.name];
		return {
			label: `${providerDisplay.displayName} Filter`,
			icon: <Icon name={providerDisplay.icon} />,
			key: "filters-" + provider.name,
			submenu: filterBoardItems(provider)
		};
	};

	const { cards, canFilter } = React.useMemo(() => {
		const items = [] as any;
		// const lowerQ = (props.q || "").toLocaleLowerCase();
		let canFilter = false;
		props.providers.forEach(provider => {
			const filterLists = getFilterLists(provider.id);
			const isFilteringLists = keyFilter(filterLists).length > 0;
			const filterBoards = getFilterBoards(provider.id);
			const isFilteringBoards = keyFilter(filterBoards).length > 0;
			const providerDisplay = PROVIDER_MAPPINGS[provider.name];
			canFilter = canFilter || providerDisplay.hasFilters || false;

			const pData = data[provider.id] || {};
			// @ts-ignore
			const cards = pData.cards || [];

			// console.warn("COMPARING: ", cards, " TO ", filterLists);
			items.push(
				...(cards
					// @ts-ignore
					.filter(card => !isFilteringLists || filterLists[card.idList || "_"])
					.filter(card => !isFilteringBoards || filterBoards[card.idBoard || "_"])
					// .filter(card => !props.q || card.title.toLocaleLowerCase().includes(lowerQ))
					.map(card => ({
						...card,
						label: card.title, //props.q ? underlineQ(card.title) : card.title,
						searchLabel: card.title,
						icon: providerDisplay.icon && <Icon name={providerDisplay.icon} />,
						key: "card-" + card.id,
						modifiedAt: card.modifiedAt,
						provider
					})) as any)
			);
		});

		derivedState.csIssues.forEach(issue => {
			items.push({
				...issue,
				label: issue.title,
				key: "card-" + issue.id,
				icon: <Icon name="issue" />,
				provider: { id: "codestream", name: "codestream" },
				body: issue.text
			});
		});

		items.sort((a, b) => b.modifiedAt - a.modifiedAt);

		return { cards: items, canFilter };
	}, [loadedCards, derivedState.startWorkPreferences, derivedState.csIssues, props.selectedCardId]);

	const menuItems = React.useMemo(() => {
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

		const items = { filters: [], services: [] } as any;
		props.providers.forEach(provider => {
			const providerDisplay = PROVIDER_MAPPINGS[provider.name];
			if (providerDisplay.hasFilters) items.filters.unshift(filterByBoardList(provider));
		});
		if (items.filters.length === 1) items.filters = items.filters[0].submenu;

		items.services = props.knownIssueProviderOptions;

		return items;
	}, [loadedCards, derivedState.startWorkPreferences]);

	const firstLoad = cards.length == 0 && isLoading;
	const selectedLabel = canFilter ? "selected items" : "my items";
	const providersLabel =
		props.providers.length === 0 ? (
			"CodeStream"
		) : (
			<SmartFormattedList
				value={props.providers.map(provider => PROVIDER_MAPPINGS[provider.name].displayName)}
			/>
		);

	return (
		<>
			<WideStatusSection id="start-work-div">
				<div className="filters" style={{ padding: "0 20px 0 20px" }}>
					<H4>
						<Tooltip title="For ad-hoc work" delay={1}>
							<RoundedLink onClick={() => selectCard({ title: "" })}>
								<Icon name="plus" />
								New Item
							</RoundedLink>
						</Tooltip>
						What are you working on?
					</H4>
					{props.providers.length > 0 || derivedState.skipConnect ? (
						<div style={{ paddingBottom: "5px" }}>
							Show{" "}
							{canFilter ? (
								<Tooltip
									defaultVisible
									trigger={["click"]}
									title={
										cards.length > 50 ? (
											<div>
												Too many items?
												<br />
												Filter them here
											</div>
										) : (
											undefined
										)
									}
									placement="bottom"
								>
									<Filter
										title="Filter Items"
										selected={"selectedLabel"}
										labels={{ selectedLabel }}
										items={[{ label: "-" }, ...menuItems.filters]}
										align="bottomLeft"
										dontCloseOnSelect
									/>
								</Tooltip>
							) : (
								"items "
							)}
							from{" "}
							<Filter
								title="Select Providers"
								selected={"providersLabel"}
								labels={{ providersLabel }}
								items={[{ label: "-" }, ...menuItems.services]}
								align="bottomLeft"
								dontCloseOnSelect
							/>
							{isLoading && !firstLoad && <Icon className="spin smaller fixed" name="sync" />}
						</div>
					) : (
						<>
							<span>
								Connect your issue provider(s), or{" "}
								<Tooltip title="Connect later on the Integrations page" placement="top">
									<Linkish
										onClick={() => dispatch(setUserPreference(["skipConnectIssueProviders"], true))}
									>
										skip this step
									</Linkish>
								</Tooltip>
							</span>
							<div style={{ height: "10px" }} />
							<IntegrationButtons style={{ marginBottom: "10px" }}>
								{props.knownIssueProviderOptions.map(item => {
									if (item.disabled) return null;
									return (
										<Provider key={item.key} onClick={item.action}>
											{item.providerIcon}
											{item.label}
										</Provider>
									);
								})}
							</IntegrationButtons>
						</>
					)}
				</div>
				{firstLoad && <LoadingMessage align="left">Loading...</LoadingMessage>}
				{cards.map(card => (
					<Tooltip title="Click to start work on this item" delay={1} placement="bottom">
						<Row
							key={card.key}
							onClick={() => selectCard(card)}
							className={card.id === props.selectedCardId ? "selected" : ""}
						>
							<div>
								{card.id === props.selectedCardId ? <Icon name="arrow-right" /> : card.icon}
							</div>
							<div>
								{card.label}
								<span className="subtle">{card.body}</span>
							</div>
							<div className="icons">
								{card.id === props.selectedCardId && (
									<Icon
										name="x-circle"
										className="clickable"
										onClick={e => {
											e.stopPropagation();
											e.preventDefault();
											selectCard();
										}}
									/>
								)}
								{card.url && (
									<Icon
										title={`Open on web`}
										delay={1}
										placement="bottomRight"
										name="globe"
										className="clickable"
										onClick={e => {
											e.stopPropagation();
											e.preventDefault();
											HostApi.instance.send(OpenUrlRequestType, {
												url: card.url
											});
										}}
									/>
								)}
								{card.provider.id === "codestream" && (
									<Icon
										title={`View Issue Details`}
										delay={1}
										placement="bottomRight"
										name="description"
										className="clickable"
										onClick={e => {
											e.stopPropagation();
											e.preventDefault();
											dispatch(setCurrentCodemark(card.id));
										}}
									/>
								)}
							</div>
						</Row>
					</Tooltip>
				))}
			</WideStatusSection>
		</>
	);
}

export const Row = styled.div`
	display: flex;
	&:not(.no-hover) {
		cursor: pointer;
	}
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	width: 100%;
	padding: 0 15px 0 20px;
	&.selected {
		color: var(--text-color-highlight);
	}
	&.wide {
		padding: 0;
	}
	&.disabled {
		opacity: 0.5;
	}
	> div {
		overflow: hidden;
		text-overflow: ellipsis;
		padding: 3px 5px 3px 0;
		&:nth-child(1) {
			flex-shrink: 0;
			.icon {
				margin: 0;
			}
		}
		&:nth-child(2) {
			flex-grow: 10;
		}
		&:nth-child(3) {
			flex-shrink: 0;
		}
	}
	.icons {
		margin-left: auto;
		text-align: right;
		.icon {
			// margin-left: 5px;
			display: none;
		}
		padding-left: 2.5px;
	}
	&:hover .icons .icon {
		display: inline-block;
	}
	&:hover time {
		display: none;
	}
	&:not(.disabled):not(.no-hover):hover {
		background: var(--app-background-color-hover);
		color: var(--text-color-highlight);
	}
	span.subtle {
		display: inline-block;
		padding-left: 15px;
		opacity: 0.5;
	}
	${Headshot} {
		top: 1px;
	}
`;

export const IssueRows = styled.div`
	border-top: 1px solid var(--base-border-color);
	padding-top: 15px;
	padding-bottom: 20px;
`;

const ConnectIssueProviders = styled.div`
	padding: 0 20px 0 20px;
`;

const Linkish = styled.span`
	text-decoration: underline;
	cursor: pointer;
	:hover {
		color: var(--text-color-highlight);
	}
`;
