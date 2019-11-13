import React from "react";
import styled from "styled-components";
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
import { useDidMount } from "../utilities/hooks";
import { getIntegrationData } from "../store/activeIntegrations/reducer";
import { updateForProvider } from "../store/activeIntegrations/actions";
import { SlackV2IntegrationData } from "../store/activeIntegrations/types";
import { setContext } from "../store/context/actions";

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
	channel.type === "direct" ? `@${channel.name}` : `#${channel.name}`;

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
	}, [data]);
}

export type SharingAttributes = Pick<
	CreateThirdPartyPostRequest,
	"providerId" | "providerTeamId" | "channelId"
>;

export function SharingControls(props: {
	sharingEnabled: boolean;
	setSharingEnabled: (value: boolean) => void;
	onChange: (values?: SharingAttributes) => void;
	showError?: boolean;
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
	const [isLoading, setIsLoading] = React.useState<boolean>(false);
	const data = useDataForTeam(
		derivedState.slackConfig ? derivedState.slackConfig.id : "",
		derivedState.selectedShareTarget && derivedState.selectedShareTarget.teamId
	);

	const setSelectedShareTarget = target =>
		dispatch(setContext({ shareTargetTeamId: target.teamId }));

	useDidMount(() => {
		let isValid = true;
		if (derivedState.selectedShareTarget) {
			if (data.get().channels.length === 0) {
				void (async () => {
					setIsLoading(true);
					const response = await HostApi.instance.send(FetchThirdPartyChannelsRequestType, {
						providerId: derivedState.slackConfig!.id,
						providerTeamId: derivedState.selectedShareTarget!.teamId
					});
					if (isValid) {
						data.set(teamData => ({ ...teamData, channels: response.channels }));
						setIsLoading(false);
					}
				})();
			}
		}
		return () => {
			isValid = false;
		};
	});

	React.useEffect(() => {
		let isValid = true;
		if (isLoading && derivedState.isConnectedToSlack) {
			setSelectedShareTarget(derivedState.shareTargets[0]);
			void (async () => {
				const response = await HostApi.instance.send(FetchThirdPartyChannelsRequestType, {
					providerId: derivedState.slackConfig!.id,
					providerTeamId: derivedState.shareTargets[0].teamId
				});
				if (isValid) {
					data.set(teamData => ({ ...teamData, channels: response.channels }));
					setIsLoading(false);
				}
			})();
			props.setSharingEnabled(true);
		}
		return () => {
			isValid = false;
		};
	}, [isLoading, derivedState.isConnectedToSlack]);

	const selectedChannel = data.get().lastSelectedChannel;

	React.useEffect(() => {
		const shareTarget = derivedState.selectedShareTarget;

		if (shareTarget && selectedChannel)
			props.onChange({
				providerId: shareTarget.providerId,
				providerTeamId: shareTarget.teamId,
				channelId: selectedChannel && selectedChannel.id
			});
		else props.onChange(undefined);
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
					label: "Add Slack workspace" as any,
					action: (() => {
						dispatch(connectProvider(derivedState.slackConfig!.id, "Compose Modal"));
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

		return dataForTeam.channels.map(channel => ({
			key: channel.name,
			label: formatChannelName(channel),
			action: () => data.set(teamData => ({ ...teamData, lastSelectedChannel: channel }))
		}));
	}, [data]);

	const authenticateWithSlack = () => {
		setIsLoading(true);
		dispatch(connectProvider(derivedState.slackConfig!.id, "Compose Modal"));
	};

	if (derivedState.slackConfig == undefined) return null;

	if (isLoading)
		return (
			<Root>
				<Icon name="sync" className="spin" /> Authenticating with Slack...{" "}
				<a
					onClick={e => {
						e.preventDefault();
						setIsLoading(false);
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
				type="checkbox"
				checked={props.sharingEnabled}
				onChange={() => props.setSharingEnabled(!props.sharingEnabled)}
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
