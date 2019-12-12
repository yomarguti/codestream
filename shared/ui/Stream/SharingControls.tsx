import React from "react";
import styled from "styled-components";
import { last as getLast } from "lodash-es";
import Menu from "./Menu";
import Icon from "./Icon";
import { HostApi } from "../webview-api";
import {
	FetchThirdPartyChannelsRequestType,
	CreateThirdPartyPostRequest
} from "@codestream/protocols/agent";
import { CodeStreamState } from "../store";
import { useSelector, useDispatch } from "react-redux";
import {
	isConnected,
	getProviderConfig,
	getConnectedSharingTargets
} from "../store/providers/reducer";
import { connectProvider } from "../store/providers/actions";
import { getIntegrationData } from "../store/activeIntegrations/reducer";
import { updateForProvider } from "../store/activeIntegrations/actions";
import { SlackV2IntegrationData } from "../store/activeIntegrations/types";
import { setContext } from "../store/context/actions";
import { safe } from "../utils";
import { useUpdates } from "../utilities/hooks";
import { setUserPreference } from "./actions";

const TextButton = styled.span`
	color: ${props => props.theme.colors.textHighlight};
	cursor: pointer;
	.octicon-chevron-down {
		transform: scale(0.7);
		margin-right: 2px;
	}
	&:focus {
		margin: -3px;
		border: 3px solid transparent;
	}
`;

export type SharingMenuProps = React.PropsWithChildren<{ items: any[]; title?: string }>;

export function SharingMenu(props: SharingMenuProps) {
	const buttonRef = React.useRef<HTMLSpanElement>(null);
	const [isOpen, toggleMenu] = React.useReducer((open: boolean) => !open, false);

	const handleKeyPress = (event: React.KeyboardEvent) => {
		if (event.key == "Enter") return toggleMenu(event);
	};

	return (
		<>
			{isOpen && buttonRef.current && (
				<Menu
					align="center"
					action={toggleMenu}
					title={props.title}
					target={buttonRef.current}
					items={props.items}
					focusOnSelect={buttonRef.current}
				/>
			)}
			<TextButton ref={buttonRef} onClick={toggleMenu} tabIndex={0} onKeyPress={handleKeyPress}>
				{props.children}
				<Icon name="chevron-down" />
			</TextButton>
		</>
	);
}

const Root = styled.div`
	color: ${props => props.theme.colors.textSubtle};
	.octicon {
		fill: currentColor;
		vertical-align: text-top;
	}
`;

const formatChannelName = (channel: { type: string; name: string }) =>
	channel.type === "direct" ? channel.name : `#${channel.name}`;

function useActiveIntegrationData<T>(providerId: string) {
	const dispatch = useDispatch();
	const data = useSelector((state: CodeStreamState) =>
		getIntegrationData<T>(state.activeIntegrations, providerId)
	);

	return React.useMemo(() => {
		return {
			get() {
				return data;
			},
			set(fn: (data: T) => T) {
				dispatch(updateForProvider(providerId, fn(data)));
			}
		};
	}, [data]);
}

function useDataForTeam(providerId: string, providerTeamId: string = "") {
	const data = useActiveIntegrationData<SlackV2IntegrationData>(providerId);
	const teamData = data.get()[providerTeamId] || { channels: [] };

	return React.useMemo(() => {
		return {
			get() {
				return teamData;
			},
			set(fn: (currentTeamData: typeof teamData) => typeof teamData) {
				data.set(d => ({ ...d, [providerTeamId]: fn(teamData) }));
			}
		};
	}, [teamData]);
}

export type SharingAttributes = Pick<
	CreateThirdPartyPostRequest,
	"providerId" | "providerTeamId" | "channelId"
>;

export const SharingControls = React.memo(
	(props: { onChangeValues: (values?: SharingAttributes) => void; showToggle?: boolean }) => {
		const dispatch = useDispatch();

		const derivedState = useSelector((state: CodeStreamState) => {
			const currentTeamId = state.context.currentTeamId;
			const preferencesForTeam = state.preferences[currentTeamId] || {};
			// this is what we've persisted in the server as the last selection the user made
			const lastShareAttributes: SharingAttributes | undefined =
				preferencesForTeam.lastShareAttributes;

			const shareTargets = getConnectedSharingTargets(state);
			const selectedShareTarget = shareTargets.find(
				target =>
					target.teamId ===
					(state.context.shareTargetTeamId ||
						(lastShareAttributes && lastShareAttributes.providerTeamId))
			);

			return {
				currentTeamId,
				on: shareTargets.length > 0 && Boolean(preferencesForTeam.shareCodemarkEnabled),
				slackConfig: getProviderConfig(state, "slack"),
				msTeamsConfig: getProviderConfig(state, "msteams"),
				isConnectedToSlack: isConnected(state, { name: "slack" }),
				isConnectedToMSTeams: isConnected(state, { name: "msteams" }),
				shareTargets,
				selectedShareTarget: selectedShareTarget || shareTargets[0],
				lastSelectedChannelId: lastShareAttributes && lastShareAttributes.channelId
			};
		});
		const [authenticationState, setAuthenticationState] = React.useState<{
			isAuthenticating: boolean;
			label: string;
		}>({ isAuthenticating: false, label: "" });
		const [isFetchingData, setIsFetchingData] = React.useState<boolean>(false);

		const selectedShareTargetTeamId = safe(() => derivedState.selectedShareTarget.teamId) as
			| string
			| undefined;

		const data = useDataForTeam(
			derivedState.slackConfig
				? derivedState.slackConfig.id
				: derivedState.msTeamsConfig
				? derivedState.msTeamsConfig.id
				: "",
			selectedShareTargetTeamId
		);

		const setCheckbox = value =>
			dispatch(setUserPreference([derivedState.currentTeamId, "shareCodemarkEnabled"], value));

		const toggleCheckbox = () => setCheckbox(!derivedState.on);

		const setSelectedShareTarget = target => {
			setCheckbox(true);
			dispatch(setContext({ shareTargetTeamId: target.teamId }));
		};

		useUpdates(() => {
			const numberOfTargets = derivedState.shareTargets.length;
			if (numberOfTargets === 0) return;

			// when the first share target is connected, turn on sharing
			if (numberOfTargets === 1 && !derivedState.on) toggleCheckbox();

			// if we're waiting on something to be added, this is it so make it the current selection
			if (authenticationState && authenticationState.isAuthenticating) {
				const newShareTarget = getLast(derivedState.shareTargets)!;
				setSelectedShareTarget(newShareTarget);
				setAuthenticationState({ isAuthenticating: false, label: "" });
			}
		}, [derivedState.shareTargets.length]);

		// when selected share target changes, fetch channels
		React.useEffect(() => {
			const { selectedShareTarget } = derivedState;
			if (selectedShareTarget) {
				if (data.get().channels.length === 0) setIsFetchingData(true);
				void (async () => {
					try {
						const response = await HostApi.instance.send(FetchThirdPartyChannelsRequestType, {
							providerId: selectedShareTarget.providerId,
							providerTeamId: selectedShareTarget.teamId
						});
						/*
							if we know the channel the user last selected for this target
							AND the webview doesn't currently have one selected,
							use the last selected one if it still exists
						 */
						const channelToSelect =
							derivedState.lastSelectedChannelId != undefined
								? response.channels.find(c => c.id === derivedState.lastSelectedChannelId)
								: undefined;
						data.set(teamData => ({
							...teamData,
							channels: response.channels,
							lastSelectedChannel: teamData.lastSelectedChannel || channelToSelect
						}));
					} catch (error) {
					} finally {
						setIsFetchingData(false);
					}
				})();
			}
		}, [selectedShareTargetTeamId]);

		const selectedChannel = data.get().lastSelectedChannel;

		React.useEffect(() => {
			const shareTarget = derivedState.selectedShareTarget;

			if (shareTarget && selectedChannel) {
				props.onChangeValues({
					providerId: shareTarget.providerId,
					providerTeamId: shareTarget.teamId,
					channelId: selectedChannel && selectedChannel.id
				});
				dispatch(
					setUserPreference([derivedState.currentTeamId, "lastShareAttributes"], {
						channelId: selectedChannel.id,
						providerId: shareTarget.providerId,
						providerTeamId: shareTarget.teamId
					})
				);
			} else props.onChangeValues(undefined);
		}, [
			derivedState.selectedShareTarget && derivedState.selectedShareTarget.teamId,
			selectedChannel && selectedChannel.id
		]);

		const shareProviderMenuItems = React.useMemo(() => {
			const targetItems = derivedState.shareTargets.map(target => ({
				key: target.teamId,
				label: (
					<>
						<span style={{ marginRight: "5px" }}>
							<Icon name={target.icon} />
						</span>
						{target.teamName}
					</>
				),
				action: () => setSelectedShareTarget(target)
			}));
			if (derivedState.slackConfig || derivedState.msTeamsConfig) {
				targetItems.push({ label: "-" } as any);
				if (derivedState.slackConfig)
					targetItems.push({
						key: "add-slack",
						label: (
							<>
								<span style={{ marginRight: "5px" }}>
									<Icon name="slack" />
								</span>
								Add Slack workspace
							</>
						),
						action: (() => {
							authenticateWithSlack();
						}) as any
					});
				// if (derivedState.msTeamsConfig) {
				// 	targetItems.push({
				// 		key: "add-msteams",
				// 		label: "Add Teams organization" as any,
				// 		action: (() => {
				// 			authenticateWithMSTeams();
				// 		}) as any
				// 	});
				// }
			}
			return targetItems;
		}, [derivedState.shareTargets, derivedState.slackConfig, derivedState.msTeamsConfig]);

		const channelMenuItems = React.useMemo(() => {
			if (derivedState.selectedShareTarget == undefined) return [];

			const dataForTeam = data.get();
			if (dataForTeam.channels == undefined) return [];

			const { dms, others } = dataForTeam.channels.reduce(
				(group, channel) => {
					const channelName = formatChannelName(channel);
					const item = {
						key: channel.name,
						label: channelName,
						searchLabel: channelName,
						action: () => {
							if (props.showToggle) setCheckbox(true);
							data.set(teamData => ({ ...teamData, lastSelectedChannel: channel }));
						}
					};
					if (channel.type === "direct") {
						group.dms.push(item);
					} else group.others.push(item);

					return group;
				},
				{ dms: [], others: [] } as { dms: any[]; others: any[] }
			);
			const search =
				others.length + dms.length > 5
					? [{ label: "-" }, { type: "search", placeholder: "Search...", action: "search" }]
					: [];

			return [...search, ...others, { label: "-" }, ...dms];
		}, [data.get().channels]);

		const authenticateWithSlack = () => {
			setAuthenticationState({ isAuthenticating: true, label: "Slack" });
			dispatch(connectProvider(derivedState.slackConfig!.id, "Compose Modal"));
		};

		const authenticateWithMSTeams = () => {
			setAuthenticationState({ isAuthenticating: true, label: "MS Teams" });
			dispatch(connectProvider(derivedState.msTeamsConfig!.id, "Compose Modal"));
		};

		if (derivedState.slackConfig == undefined) return null;

		if (authenticationState && authenticationState.isAuthenticating)
			return (
				<Root>
					<Icon name="sync" className="spin" /> Authenticating with {authenticationState.label}...{" "}
					<a
						onClick={e => {
							e.preventDefault();
							setAuthenticationState({ isAuthenticating: false, label: "" });
						}}
					>
						cancel
					</a>
				</Root>
			);

		if (isFetchingData)
			return (
				<Root>
					<Icon name="sync" className="spin" /> Fetching channels...{" "}
					<a
						onClick={e => {
							e.preventDefault();
							setIsFetchingData(false);
						}}
					>
						cancel
					</a>
				</Root>
			);

		if (!derivedState.isConnectedToSlack && !derivedState.isConnectedToMSTeams)
			return (
				<Root>
					Share on{" "}
					<TextButton
						onClick={async e => {
							e.preventDefault();
							authenticateWithSlack();
						}}
					>
						<Icon name="slack" /> Slack
					</TextButton>
					{/*
				{derivedState.msTeamsConfig != undefined && (
					<>
						{" "}
						or{" "}
						<TextButton
							onClick={e => {
								e.preventDefault();
								authenticateWithMSTeams();
							}}
						>
							<Icon name="msteams" /> MS Teams
						</TextButton>
					</>
				)}
						*/}
				</Root>
			);

		return (
			<Root>
				{props.showToggle && (
					<>
						<input type="checkbox" checked={derivedState.on} onChange={toggleCheckbox} />
					</>
				)}
				Share on{" "}
				<SharingMenu items={shareProviderMenuItems}>
					{derivedState.selectedShareTarget!.teamName}
				</SharingMenu>{" "}
				in{" "}
				<SharingMenu items={channelMenuItems} title="Post to...">
					{selectedChannel == undefined ? "select a channel" : formatChannelName(selectedChannel)}
				</SharingMenu>
			</Root>
		);
	}
);
