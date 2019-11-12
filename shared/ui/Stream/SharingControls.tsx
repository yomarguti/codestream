import React from "react";
import styled from "styled-components";
import { PropsWithTheme } from "../src/themes";
import Menu from "./Menu";
import Icon from "./Icon";
import { HostApi } from "../webview-api";
import { FetchThirdPartyChannelsRequestType } from "@codestream/protocols/agent";
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
import { emptyObject, safe } from "../utils";

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

export function SharingControls() {
	const dispatch = useDispatch();
	const derivedState = useSelector((state: CodeStreamState) => {
		return {
			slackConfig: getProviderConfig(state, "slack"),
			msTeamsConfig: getProviderConfig(state, "msteams"),
			isConnectedToSlack: isConnected(state, "slack"),
			shareTargets: getConnectedSharingTargets(state)
		};
	});
	const [sharingEnabled, setSharingEnabled] = React.useState(false);
	const [isLoading, setIsLoading] = React.useState<boolean>(false);
	const [selectedShareProvider, setSelectedShareProvider] = React.useState<
		{ providerId: string; teamId: string; teamName: string } | undefined
	>(derivedState.shareTargets[0]);
	const data = useActiveIntegrationData<SlackV2IntegrationData>(
		derivedState.slackConfig ? derivedState.slackConfig.id : ""
	);

	useDidMount(() => {
		let isValid = true;
		if (selectedShareProvider) {
			if (!safe(() => data.get()[selectedShareProvider.teamId].channels.length > 0)) {
				void (async () => {
					setIsLoading(true);
					const response = await HostApi.instance.send(FetchThirdPartyChannelsRequestType, {
						providerId: derivedState.slackConfig!.id,
						teamId: selectedShareProvider.teamId
					});
					if (isValid) {
						data.set(currentData => {
							const teamData = { ...(currentData[selectedShareProvider.teamId] || emptyObject) };
							teamData.channels = response.channels;
							return { ...currentData, [selectedShareProvider.teamId]: teamData };
						});
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
			setSelectedShareProvider(derivedState.shareTargets[0]);
			void (async () => {
				const response = await HostApi.instance.send(FetchThirdPartyChannelsRequestType, {
					providerId: derivedState.slackConfig!.id,
					teamId: derivedState.shareTargets[0].teamId
				});
				if (isValid) {
					data.set(currentData => {
						const teamData = { ...(currentData[selectedShareProvider!.teamId] || emptyObject) };
						teamData.channels = response.channels;
						return { ...currentData, [selectedShareProvider!.teamId]: teamData };
					});
					setIsLoading(false);
				}
			})();
			setSharingEnabled(true);
		}
		return () => {
			isValid = false;
		};
	}, [isLoading, derivedState.isConnectedToSlack]);

	const [selectedChannel, setSelectedChannel] = React.useState<any>();

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
			action: () =>
				setSelectedShareProvider({
					providerId: target.providerId,
					teamId: target.teamId,
					teamName: target.teamName
				})
		}));
		if (derivedState.slackConfig || derivedState.msTeamsConfig) {
			targetItems.push({ label: "-" } as any);
			if (derivedState.slackConfig)
				targetItems.push({
					key: "add-slack",
					label: "Add Slack workspace" as any,
					action: () => {
						dispatch(connectProvider(derivedState.slackConfig!.id, "Compose Modal"));
					}
				});
			if (derivedState.msTeamsConfig) {
				targetItems.push({
					key: "add-msteams",
					label: "Add Teams organization" as any,
					action: () => {}
				});
			}
		}
		return targetItems;
	}, [derivedState.shareTargets, derivedState.slackConfig, derivedState.msTeamsConfig]);

	const channelMenuItems = React.useMemo(() => {
		if (selectedShareProvider == undefined) return [];

		const dataForTeam = data.get()[selectedShareProvider.teamId];
		if (dataForTeam == undefined) return [];

		return dataForTeam.channels.map(channel => ({
			key: channel.name,
			label: formatChannelName(channel),
			action: () => setSelectedChannel(channel)
		}));
	}, [data]);

	const authenticateWithSlack = async () => {
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
				checked={sharingEnabled}
				onChange={() => setSharingEnabled(enabled => !enabled)}
			/>{" "}
			Share on{" "}
			<SharingMenu items={shareProviderMenuItems}>{selectedShareProvider!.teamName}</SharingMenu> in{" "}
			<SharingMenu items={channelMenuItems}>
				{selectedChannel == undefined ? "select a channel" : formatChannelName(selectedChannel)}
			</SharingMenu>
		</Root>
	);
}
