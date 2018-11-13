import { Logger } from "../logger";
import { CodeStreamSession } from "../session";
import { TelemetryRequest, TelemetryRequestType } from "../shared/agent.protocol";
import { debug, lspHandler } from "../system";
import { MixPanelTelemetryService } from "../telemetry/mixpanel";

export class TelemetryManager {
	private readonly _mixpanel: MixPanelTelemetryService;

	constructor(session: CodeStreamSession) {
		// TODO: Respect VSCode telemetry opt out
		this._mixpanel = new MixPanelTelemetryService(session, false);
	}

	setConsent(hasConsented: boolean) {
		this._mixpanel.setConsent(hasConsented);
	}

	setDistinctId(id: string) {
		this._mixpanel.setDistinctId(id);
	}

	setSuperProps(props: { [key: string]: string | number | boolean }) {
		this._mixpanel.setSuperProps(props);
	}

	@debug()
	@lspHandler(TelemetryRequestType)
	track(request: TelemetryRequest) {
		const cc = Logger.getCorrelationContext();
		try {
			void this._mixpanel.track(request.eventName, request.properties);
		} catch (ex) {
			Logger.error(ex, cc);
		}
	}
}
