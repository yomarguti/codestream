import { RequestType } from "vscode-jsonrpc";
import { findHost, IpcHost, NotificationType, WebviewIpcMessage } from "./ipc/webview.protocol";
import { shortUuid } from "./utils";

type RequestOrNotificationType<P, R> = RequestType<P, R, any, any> | NotificationType<P, R>;

type RequestOf<RT> = RT extends RequestOrNotificationType<infer RQ, any> ? RQ : never;
type ResponseOf<RT> = RT extends RequestOrNotificationType<any, infer R> ? R : never;

class EventEmitter {
	private listenersByEvent = new Map<string, Function[]>();

	on<NT extends NotificationType<any, any>>(
		eventType: NT,
		listener: (event: RequestOf<NT>) => void
	) {
		const listeners = this.listenersByEvent.get(eventType.method) || [];
		listeners.push(listener);
		this.listenersByEvent.set(eventType.method, listeners);
		return {
			dispose: () => {
				const listeners = this.listenersByEvent.get(eventType.method)!.filter(l => l !== listener);
				this.listenersByEvent.set(eventType.method, listeners);
			}
		};
	}

	emit(eventName: string, body: any) {
		setImmediate(() => (this.listenersByEvent.get(eventName) || []).forEach(l => l(body)));
	}
}

let sequence = 0;

export class HostApi extends EventEmitter {
	private pendingCommands: Map<string, any>;
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
		this.pendingCommands = new Map();
		this.port = port;

		port.onmessage = ({ data }: { data: WebviewIpcMessage }) => {
			if (data.id) {
				const pending = this.pendingCommands.get(data.id);
				console.debug(`received response from host for ${data.id}(${pending.method})`, data);
				data.params ? pending.resolve(data.params) : pending.reject(data.error);
				this.pendingCommands.delete(data.id);
				return;
			}
			if (data.method) {
				console.debug(`received ${data.method} from host`);
				this.emit(data.method, data.params);
			}
		};
	}

	send<RT extends RequestOrNotificationType<any, any>>(
		request: RT,
		args: RequestOf<RT>
	): Promise<ResponseOf<RT>> {
		const id = this.nextId();
		return new Promise((resolve, reject) => {
			this.pendingCommands.set(id, { resolve, reject, method: request.method });

			const payload = {
				id,
				method: request.method,
				params: args
			};
			this.port.postMessage(payload);
			console.debug(`command ${id}:${request.method} sent to host`, payload);
		});
	}

	private nextId() {
		if (sequence === Number.MAX_SAFE_INTEGER) {
			sequence = 1;
		} else {
			sequence++;
		}

		return `${sequence}:${shortUuid()}`;
	}
}
