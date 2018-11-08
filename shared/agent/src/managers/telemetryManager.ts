import { Container } from "../container";
import { Logger } from "../logger";
import { CodeStreamSession } from "../session";
import { TelemetryRequest, TelemetryRequestType } from "../shared/agent.protocol";
import { lspHandler } from "../system/decorators";
import { MixPanelTelemetryService } from "../telemetry";

export class TelemetryManager {
	private readonly _telemetryService: MixPanelTelemetryService;

	constructor(session: CodeStreamSession) {
		this._telemetryService = Container.instance().telemetry;
	}

	@lspHandler(TelemetryRequestType)
	private _trackEvent = (request: TelemetryRequest) => {
		Logger.debug("_trackEvent called from TelemetryManager");
		try {
			const resp = this._telemetryService.track(request.eventName, request.properties);
		} catch (ex) {
			Logger.error(ex);
		}
	}
}
