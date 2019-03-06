import { NotificationType, RequestType } from "vscode-jsonrpc";
import {
	findHost,
	IpcHost,
	WebviewIpcMessage,
	isIpcResponseMessage,
	isIpcRequestMessage
} from "./ipc/webview.protocol";
import { shortUuid } from "./utils";

type NotificationParamsOf<NT> = NT extends NotificationType<infer N, any> ? N : never;
type RequestParamsOf<RT> = RT extends RequestType<infer R, any, any, any> ? R : never;
type RequestResponseOf<RT> = RT extends RequestType<any, infer R, any, any> ? R : never;

class EventEmitter {
	private listenersByEvent = new Map<string, Function[]>();

	on<NT extends NotificationType<any, any>>(
		eventType: NT,
		listener: (event: NotificationParamsOf<NT>) => void,
		thisArgs?: any
	) {
		const listeners = this.listenersByEvent.get(eventType.method) || [];
		listeners.push(thisArgs !== undefined ? listener.bind(thisArgs) : listener);
		this.listenersByEvent.set(eventType.method, listeners);
		return {
			dispose: () => {
				const listeners = this.listenersByEvent.get(eventType.method)!.filter(l => l !== listener);
				this.listenersByEvent.set(eventType.method, listeners);
			}
		};
	}

	emit(eventName: string, body: any) {
		const listeners = this.listenersByEvent.get(eventName);
		if (listeners == null || listeners.length === 0) return;

		setTimeout(() => {
			for (const l of listeners) {
				l(body);
			}
		}, 0);
	}
}

let sequence = 0;

export class HostApi extends EventEmitter {
	private _pendingRequests: Map<
		string,
		{
			method: string;
			resolve: (value?: any | PromiseLike<any>) => void;
			reject: (reason?: any) => void;
		}
	>;
	private port: IpcHost;

	private static _instance: HostApi;
	static get instance(): HostApi {
		if (this._instance === undefined) {
			this._instance = new HostApi(findHost());
		}
		return this._instance;
	}

	protected constructor(port: any) {
		super();
		this._pendingRequests = new Map();
		this.port = port;

		port.onmessage = ({ data }: { data: WebviewIpcMessage }) => {
			if (isIpcResponseMessage(data)) {
				const pending = this._pendingRequests.get(data.id);
				if (pending == null) {
					console.debug(
						`received response from host for ${data.id}; unable to find a pending request`,
						data
					);

					return;
				}

				console.debug(
					`received response from host for ${data.id}; found pending request: ${pending.method}`,
					data
				);
				data.error != null ? pending.reject(data.error) : pending.resolve(data.params);
				this._pendingRequests.delete(data.id);

				return;
			}

			if (isIpcRequestMessage(data)) {
				// TODO: Handle requests from the host
				debugger;
				return;
			}

			console.debug(`received ${data.method} from host`);
			this.emit(data.method, data.params);
		};
	}

	notify<NT extends NotificationType<any, any>>(type: NT, params: NotificationParamsOf<NT>): void {
		const payload = {
			method: type.method,
			params: params
		};
		this.port.postMessage(payload);
		console.debug(`notification ${type.method} sent to host`, payload);
	}

	send<RT extends RequestType<any, any, any, any>>(
		type: RT,
		params: RequestParamsOf<RT>
	): Promise<RequestResponseOf<RT>> {
		const id = this.nextId();
		return new Promise((resolve, reject) => {
			this._pendingRequests.set(id, { resolve, reject, method: type.method });

			const payload = {
				id,
				method: type.method,
				params: params
			};
			this.port.postMessage(payload);
			console.debug(`request ${id}:${type.method} sent to host`, payload);
		});
	}

	private nextId() {
		if (sequence === Number.MAX_SAFE_INTEGER) {
			sequence = 1;
		} else {
			sequence++;
		}

		return `wv:${sequence}:${shortUuid()}`;
	}
}
