import * as Sentry from "@sentry/node";
import * as os from "os";
import { Container } from "./container";
import { CodeStreamSession } from "./session";
import {
	// CodeStreamEnvironment,
	ReportErrorRequest,
	ReportErrorRequestType
} from "./shared/agent.protocol";

export class ErrorReporter {
	private _session: CodeStreamSession;

	constructor(session: CodeStreamSession) {
		this._session = session;
		if (
			true
			// (session.environment !== CodeStreamEnvironment.PD &&
			// 	session.environment !== CodeStreamEnvironment.Unknown)
		) {
			Sentry.init({
				dsn: "https://7c34949981cc45848fc4e3548363bb17@sentry.io/1314159",
				release: this._session.versionInfo.extension.versionFormatted,
				environment: this._session.environment
			});
			session.agent.registerHandler(ReportErrorRequestType, this.reportError);
		}
	}

	private reportError = async (request: ReportErrorRequest) => {
		//  TODO: acknowledge telemetryConsent
		const team = await Container.instance().teams.getById(this._session.teamId);
		const isSlackTeam = !!(team.providerInfo && team.providerInfo.slack);

		Sentry.captureEvent({
			level: Sentry.Severity.Error,
			user: {
				id: this._session.userId,
				email: this._session.userEmail,
				team: {
					id: team.id,
					name: team.name,
					isSlackTeam
				}
			},
			timestamp: Date.now(),
			platform: os.platform(),
			message: request.message,
			extra: {
				ideVersion: this._session.versionInfo.ide.version,
				...request.extra
			},
			tags: {
				source: request.source
			}
		});
	}
}
