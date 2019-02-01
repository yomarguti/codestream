import * as Sentry from "@sentry/node";
import { Severity } from "@sentry/node";
import * as os from "os";
import { Container } from "./container";
import { CodeStreamSession } from "./session";
import {
	CodeStreamEnvironment,
	ReportMessageRequest,
	ReportMessageRequestType
} from "./shared/agent.protocol";
import { lsp, lspHandler } from "./system";

@lsp
export class ErrorReporter {
	constructor(session: CodeStreamSession) {
		if (session.environment === CodeStreamEnvironment.Production) {
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
					scope.setTag("ide", session.versionInfo.ide.name);
					scope.setExtra("ideVersion", session.versionInfo.ide.version);
					scope.setTag("source", "agent");
				});
			});
		}
	}

	@lspHandler(ReportMessageRequestType)
	protected reportMessage(request: ReportMessageRequest) {
		Sentry.captureEvent({
			level: Severity.fromString(request.type),
			timestamp: Date.now(),
			message: request.message,
			extra: request.extra,
			tags: {
				source: request.source
			}
		});
	}
}
