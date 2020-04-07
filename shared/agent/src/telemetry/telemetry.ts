"use strict";
import uuid from "uuid/v4";
import { Logger } from "../logger";
import { CodeStreamSession, SessionStatus, SessionStatusChangedEvent } from "../session";

// FIXME: sorry, typescript purists: i simply gave up trying to get the type definitions for this module to work
import Analytics from "analytics-node";
import { debug } from "../system";

export class TelemetryService {
	private _segmentInstance: Analytics | undefined;
	private _superProps: { [key: string]: any };
	private _distinctId?: string;
	private _anonymousId: string;
	private _hasOptedOut: boolean;
	private _session: CodeStreamSession;
	private _readyPromise: Promise<void>;
	private _firstSessionStartedAt?: number;
	private _firstSessionTimesOutAfter?: number;
	private _eventQueue: { event: string, data?: { [key: string]: string | number | boolean } }[] = [];
	private _aliasing: boolean = false;

	private _onReady: () => void = () => {};

	/**
	 * @param {boolean} hasOptedOut - Has the user opted out of tracking?
	 * @param {{ [key: string]: string | number }} [opts] - Additional options
	 */
	constructor(
		session: CodeStreamSession,
		hasOptedOut: boolean,
		opts?: { [key: string]: string | number | boolean }
	) {
		Logger.debug("Telemetry created");

		this._session = session;
		this._superProps = {};
		this._hasOptedOut = false;

		session.ready().then(() => this.initialize());

		const props = { ...opts, Endpoint: session.versionInfo.ide.name };
		this._superProps = props;
		this._hasOptedOut = hasOptedOut;
		this._anonymousId = uuid();

		session.onDidChangeSessionStatus(this.onSessionStatusChanged);

		this._readyPromise = new Promise<void>(resolve => {
			this._onReady = () => {
				Logger.debug("Telemetry is ready");
				resolve();
			};
		});
	}

	async ready() {
		return this._readyPromise;
	}

	async initialize() {
		Logger.debug("Telemetry initializing...");
		let token = "";
		try {
			token = await this._session.api.getTelemetryKey();
		} catch (ex) {
			Logger.error(ex);
		}

		try {
			this._segmentInstance = new Analytics(token);
		} catch (ex) {
			Logger.error(ex);
		}
		Logger.debug("Telemetry initialized");
		this._onReady();
	}

	private onSessionStatusChanged = async (event: SessionStatusChangedEvent) => {
		if (event.getStatus() === SessionStatus.SignedOut) return;

		const { preferences } = await this._session.api.getPreferences();

		// legacy consent
		if ("telemetryConsent" in preferences) {
			this.setConsent(preferences.telemetryConsent!);
		} else {
			this.setConsent(!Boolean(preferences.telemetryOptOut));
		}
	}

	alias(id: string) {
		if (!this._segmentInstance) {
			return;
		}

		// HACK ALERT - there is a race condition situation with mixpanel where the alias can take some time, and
		// until this happens, events which come in are not properly linked to the correct distinct ID ... 
		// read about it here: https://help.mixpanel.com/hc/en-us/articles/115004497803-Identity-Management-Best-Practices#serverside-aliasing
		// to get around this BS, we'll queue any tracking events until we can be reasonably sure the alias has gone
		// through, we'll say 2 seconds ... then we'll flush the queue
		// the hope here is that we can move to mixpanel's new Identity Merge system, where this kind of thing is no
		// longer an issue: https://help.mixpanel.com/hc/en-us/articles/360039133851#enable-id-merge
		this._aliasing = true;
		setTimeout(() => {
			this._aliasing = false;
			while (this._eventQueue.length) {
				const event = this._eventQueue.shift();
				this.track(event!.event, event!.data);
			}
		}, 2000);

		Logger.debug(`Telemetry alias ${this._anonymousId} with ${id}`);
		this._segmentInstance.alias({ previousId: this._anonymousId, userId: id });
		this._segmentInstance.flush();
	}

	identify(id: string, props?: { [key: string]: any }) {
		this._distinctId = id;
		if (this._hasOptedOut || this._segmentInstance == null) {
			return;
		}

		try {
			Logger.debug(`Telemetry identify ${this._distinctId}`);
			this._segmentInstance.identify({
				userId: this._distinctId,
				traits: props
			});
			this._segmentInstance.flush();
		} catch (ex) {
			Logger.error(ex);
		}
	}

	setConsent(hasConsented: boolean) {
		this._hasOptedOut = !hasConsented;
	}

	setSuperProps(props: { [key: string]: string | number | boolean }) {
		this._superProps = props;
	}

	setFirstSessionProps(firstSessionStartedAt: number, firstSessionTimesOutAfter: number) {
		this._firstSessionStartedAt = firstSessionStartedAt;
		this._firstSessionTimesOutAfter = firstSessionTimesOutAfter;
	}

	@debug()
	track(event: string, data?: { [key: string]: string | number | boolean }) {
		if (this._aliasing) {
			// see the comment in the alias() function above, for why this madness is occurring
			this._eventQueue.push({ event, data });
			return;
		}

		const cc = Logger.getCorrelationContext();

		if (this._hasOptedOut || this._segmentInstance == null) {
			return;
		}

		if (
			this._firstSessionStartedAt &&
			this._firstSessionTimesOutAfter &&
			Date.now() > this._firstSessionStartedAt + this._firstSessionTimesOutAfter
		) {
			this._superProps["First Session"] = false;
		}

		const payload: { [key: string]: any } = { ...data, ...this._superProps };

		if (this._distinctId != null) {
			payload["distinct_id"] = this._distinctId;
		}

		try {
			this._segmentInstance.track({
				userId: this._distinctId,
				anonymousId: this._distinctId ? undefined : this._anonymousId,
				event,
				properties: payload
			});
			this._segmentInstance.flush();
		} catch (ex) {
			Logger.error(ex, cc);
		}
	}
}
