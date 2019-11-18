import React from "react";
import styled from "styled-components";
import { last as getLast } from "lodash-es";
import { PropsWithTheme } from "../src/themes";
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

const TextButton = styled.span`
	color: ${(props: PropsWithTheme<{}>) => props.theme.colors.textHighlight};
	cursor: pointer;
	.octicon-chevron-down {
		transform: scale(0.7);
	}
`;

export type SharingMenuProps = React.PropsWithChildren<{ items: any[] }>;

function SharingMenu(props: SharingMenuProps) {
	const buttonRef = React.useRef<HTMLSpanElement>(null);
	const [isOpen, toggleMenu] = React.useReducer((open: boolean) => !open, false);

	return (
		<>
			{isOpen && buttonRef.current && (
				<Menu align="center" action={toggleMenu} target={buttonRef.current} items={props.items} />
			)}
			<TextButton ref={buttonRef} onClick={toggleMenu}>
				{props.children} <Icon name="chevron-down" />
			</TextButton>
		</>
	);
}

const Root = styled.div<PropsWithTheme<{}>>`
	color: ${(props: PropsWithTheme<{}>) => props.theme.colors.textSubtle};
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

export function SharingControls(props: {
	on: boolean;
	onToggle: (value: boolean) => void;
	onChangeValues: (values?: SharingAttributes) => void;
	showError?: boolean;
	disabled?: boolean;
}) {
	const dispatch = useDispatch();
	const derivedState = useSelector((state: CodeStreamState) => {
		const shareTargets = getConnectedSharingTargets(state);
		const selectedShareTarget = shareTargets.find(
			target => target.teamId === state.context.shareTargetTeamId
		);
		return {
			slackConfig: getProviderConfig(state, "slack"),
			msTeamsConfig: getProviderConfig(state, "msteams"),
			isConnectedToSlack: isConnected(state, { name: "slack" }),
			shareTargets,
			selectedShareTarget: selectedShareTarget || shareTargets[0]
		};
	});
	const [isAuthenticating, setIsAuthenticating] = React.useState<boolean>(false);
	const [isFetchingData, setIsFetchingData] = React.useState<boolean>(false);

	const selectedShareTargetTeamId = safe(() => derivedState.selectedShareTarget.teamId) as
		| string
		| undefined;

	const data = useDataForTeam(
		derivedState.slackConfig ? derivedState.slackConfig.id : "",
		selectedShareTargetTeamId
	);

	const setSelectedShareTarget = target =>
		dispatch(setContext({ shareTargetTeamId: target.teamId }));

	useUpdates(() => {
		const numberOfTargets = derivedState.shareTargets.length;
		if (numberOfTargets === 0) return;

		// when the first share target is connected, turn on sharing
		if (numberOfTargets === 1) props.onToggle(true);

		// if we're waiting on something to be added, this is it so make it the current selection
		if (isAuthenticating) {
			const newShareTarget = getLast(derivedState.shareTargets)!;
			setSelectedShareTarget(newShareTarget);
			setIsAuthenticating(false);
		}
	}, [derivedState.shareTargets.length]);

	// when selected share target changes, fetch channels
	React.useEffect(() => {
		const { selectedShareTarget } = derivedState;
		if (selectedShareTarget) {
			setIsFetchingData(true);
			void (async () => {
				try {
					const response = await HostApi.instance.send(FetchThirdPartyChannelsRequestType, {
						providerId: selectedShareTarget.providerId,
						providerTeamId: selectedShareTarget.teamId
					});
					data.set(teamData => ({ ...teamData, channels: response.channels }));
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

		if (shareTarget && selectedChannel)
			props.onChangeValues({
				providerId: shareTarget.providerId,
				providerTeamId: shareTarget.teamId,
				channelId: selectedChannel && selectedChannel.id
			});
		else props.onChangeValues(undefined);
	}, [derivedState.selectedShareTarget, selectedChannel]);

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
			if (derivedState.msTeamsConfig) {
				targetItems.push({
					key: "add-msteams",
					label: "Add Teams organization" as any,
					action: (() => {}) as any
				});
			}
		}
		return targetItems;
	}, [derivedState.shareTargets, derivedState.slackConfig, derivedState.msTeamsConfig]);

	const channelMenuItems = React.useMemo(() => {
		if (derivedState.selectedShareTarget == undefined) return [];

		const dataForTeam = data.get();
		if (dataForTeam.channels == undefined) return [];

		const { dms, others } = dataForTeam.channels.reduce(
			(group, channel) => {
				const item = {
					key: channel.name,
					label: formatChannelName(channel),
					action: () => data.set(teamData => ({ ...teamData, lastSelectedChannel: channel }))
				};
				if (channel.type === "direct") {
					group.dms.push(item);
				} else group.others.push(item);

				return group;
			},
			{ dms: [], others: [] } as { dms: any[]; others: any[] }
		);

		return [...others, { label: "-" }, ...dms];
	}, [data.get().channels]);

	const authenticateWithSlack = () => {
		setIsAuthenticating(true);
		dispatch(connectProvider(derivedState.slackConfig!.id, "Compose Modal"));
	};

	if (derivedState.slackConfig == undefined) return null;

	if (isAuthenticating)
		return (
			<Root>
				<Icon name="sync" className="spin" /> Authenticating with Slack...{" "}
				<a
					onClick={e => {
						e.preventDefault();
						setIsAuthenticating(false);
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

	if (!derivedState.isConnectedToSlack)
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
				{derivedState.msTeamsConfig != undefined && (
					<>
						{" "}
						or{" "}
						<TextButton
							onClick={e => {
								e.preventDefault();
								// setIsLoading("msteams");
							}}
						>
							<Icon name="msteams" /> MS Teams
						</TextButton>
					</>
				)}
			</Root>
		);

	return (
		<Root>
			<input
				disabled={props.disabled}
				type="checkbox"
				checked={props.on}
				onChange={() => props.onToggle(!props.on)}
			/>{" "}
			Share on{" "}
			<SharingMenu items={shareProviderMenuItems}>
				{derivedState.selectedShareTarget!.teamName}
			</SharingMenu>{" "}
			in{" "}
			<SharingMenu items={channelMenuItems}>
				{selectedChannel == undefined ? "select a channel" : formatChannelName(selectedChannel)}
			</SharingMenu>{" "}
			{props.showError && selectedChannel == undefined && (
				<small style={{ color: "red" }}>required</small>
			)}
		</Root>
	);
}
