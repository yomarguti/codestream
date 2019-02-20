"use strict";

import { Logger } from "../logger";
import { CodeStreamSession } from "../session";

// FIXME: sorry, typescript purists: i simply gave up trying to get the type definitions for this module to work
const Analytics = require("analytics-node");

export class TelemetryService {
	private _segmentInstance: any;
	private _superProps: object;
	private _distinctId?: string;
	private _hasOptedOut: boolean;
	private _session: CodeStreamSession;
	private _readyPromise: Promise<void>;
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
		Logger.debug("AnalyticsService created");

		this._session = session;
		this._superProps = {};
		this._hasOptedOut = false;

		session
			.ready()
			.then(() => this.initialize())
			.then(() => session.api.getPreferences())
			.then(({ preferences }) => {
				// legacy consent
				if ("telemetryConsent" in preferences) {
					this.setConsent(preferences.telemetryConsent!);
				} else {
					this.setConsent(!Boolean(preferences.telemetryOptOut));
				}
			});

		const props = { ...opts, Endpoint: session.versionInfo.ide.name };
		this._superProps = props;
		this._hasOptedOut = hasOptedOut;

		this._readyPromise = new Promise<void>(resolve => {
			this._onReady = () => {
				Logger.debug("Telemetry is ready");
				resolve();
			};
		});
	}

	async ready () {
		return this._readyPromise;
	}

	async initialize () {
		Logger.debug("Initializing telemetry...");
		let token;
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
		} catch (ex) {
			Logger.error(ex);
		}
	}

	alias(id?: string) {
		if (this._hasOptedOut || this._distinctId == null || this._segmentInstance == null) {
			return;
		}

		try {
			this._segmentInstance.alias({
				previousId: this._distinctId,
				userId: id
			});
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

	track(event: string, data?: { [key: string]: string | number | boolean }) {
		Logger.debug(`Tracking event :: ${event}`);

		if (this._hasOptedOut || this._segmentInstance == null) {
			return;
		}
		const payload: { [key: string]: any } = { ...data, ...this._superProps };

		if (this._distinctId != null) {
			payload["distinct_id"] = this._distinctId;
		}

		try {
			this._segmentInstance.track({
				userId: this._distinctId,
				event,
				properties: payload
			});
		} catch (ex) {
			Logger.debug("TRACKING ERROR!!!", ex);
			Logger.error(ex);
		}
	}
}
