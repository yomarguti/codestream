import { Logger } from "../logger";
import { CodeStreamSession } from "../session";
import { TelemetryRequest, TelemetryRequestType } from "../shared/agent.protocol";
import { debug, lsp, lspHandler } from "../system";
import { TelemetryService } from "../telemetry/telemetry";

@lsp
export class TelemetryManager {
	private readonly _telemetry: TelemetryService;

	constructor(session: CodeStreamSession) {
		// TODO: Respect VSCode telemetry opt out
		this._telemetry = new TelemetryService(session, false);
		session
			.ready()
			.then(() => session.api.getPreferences())
			.then(({ preferences }) => {
				// legacy consent
				if ("telemetryConsent" in preferences) {
					this.setConsent(preferences.telemetryConsent!);
				} else {
					this.setConsent(!Boolean(preferences.telemetryOptOut));
				}
			});
	}

	setConsent(hasConsented: boolean) {
		this._telemetry.setConsent(hasConsented);
	}

	identify(id: string, props: { [key: string]: any }) {
		this._telemetry.identify(id, props);
	}

	setSuperProps(props: { [key: string]: string | number | boolean }) {
		this._telemetry.setSuperProps(props);
	}

	@debug()
	@lspHandler(TelemetryRequestType)
	track(request: TelemetryRequest) {
		Logger.debug("(6) telemetryManager :: track has been called : ", request.eventName);
		const cc = Logger.getCorrelationContext();
		try {
			void this._telemetry.track(request.eventName, request.properties);
		} catch (ex) {
			Logger.error(ex, cc);
		}
	}
}
