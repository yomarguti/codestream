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
	constructor(session: CodeStreamSession) {
		if (
			true
			// (session.environment !== CodeStreamEnvironment.PD &&
			// 	session.environment !== CodeStreamEnvironment.Unknown)
		) {
			Sentry.init({
				dsn: "https://7c34949981cc45848fc4e3548363bb17@sentry.io/1314159",
				release: session.versionInfo.extension.versionFormatted,
				environment: session.environment
			});

			session.ready().then(() => {
				Sentry.configureScope(async scope => {
					scope.setTag("platform", os.platform());
					const team = await Container.instance().teams.getById(session.teamId);
					const isSlackTeam = !!(team.providerInfo && team.providerInfo.slack);
					//  TODO: acknowledge telemetryConsent
					scope.setUser({
						id: session.userId,
						email: session.email,
						team: {
							id: team.id,
							name: team.name,
							isSlackTeam
						}
					});
					scope.setExtra("ideVersion", session.versionInfo.ide.version);
					scope.setTag("source", "agent");
				});
			});

			session.agent.registerHandler(ReportErrorRequestType, this.reportError);
		}
	}

	private reportError = async (request: ReportErrorRequest) => {
		Sentry.captureEvent({
			level: Sentry.Severity.Error,
			timestamp: Date.now(),
			message: request.message,
			extra: request.extra,
			tags: {
				source: request.source
			}
		});
	}
}
