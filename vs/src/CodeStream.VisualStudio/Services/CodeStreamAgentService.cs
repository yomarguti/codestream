using CodeStream.VisualStudio.Annotations;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.UI;
using Microsoft.VisualStudio.LanguageServer.Protocol;
using Microsoft.VisualStudio.Shell;
using Newtonsoft.Json.Linq;
using Serilog;
using StreamJsonRpc;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.VisualStudio.ComponentModelHost;
using Task = System.Threading.Tasks.Task;
using TextDocumentIdentifier = CodeStream.VisualStudio.Models.TextDocumentIdentifier;
#if DEBUG
using TraceLevel = CodeStream.VisualStudio.Core.Logging.TraceLevel;
#endif
// ReSharper disable ClassNeverInstantiated.Global
// ReSharper disable UnusedAutoPropertyAccessor.Global

namespace CodeStream.VisualStudio.Services {
	public interface SCodeStreamAgentService { }

	public interface ICodeStreamAgentService {
		ISessionService SessionService { get; }
		Task SetRpcAsync(JsonRpc rpc);
		Task<T> SendAsync<T>(string name, object arguments, CancellationToken? cancellationToken = null);
		Task<CreateDocumentMarkerPermalinkResponse> CreatePermalinkAsync(Range range, string uri, string privacy);
		Task<GetDocumentFromKeyBindingResponse> GetDocumentFromKeyBindingAsync(int key);
		Task<CreatePostResponse> CreatePostAsync(string streamId, string threadId, string text);
		Task<GetFileStreamResponse> GetFileStreamAsync(Uri uri);
		Task<GetPostResponse> GetPostAsync(string streamId, string postId);
		Task<GetUserResponse> GetUserAsync(string userId);
		Task<GetStreamResponse> GetStreamAsync(string streamId);
		Task<CsDirectStream> CreateDirectStreamAsync(List<string> memberIds);
		Task<JToken> LoginViaTokenAsync(string email, string token, string serverUrl);
		Task<JToken> LoginViaOneTimeCodeAsync(string signupToken, string serverUrl);
		Task<JToken> LoginAsync(string email, string password, string serverUrl);
		Task<JToken> LogoutAsync();
		Task<JToken> GetBootstrapAsync(Settings settings, JToken state = null, bool isAuthenticated = false);
		Task<FetchCodemarksResponse> GetMarkersAsync(string streamId);
		Task<DocumentFromMarkerResponse> GetDocumentFromMarkerAsync(DocumentFromMarkerRequest request);
		Task<DocumentMarkersResponse> GetMarkersForDocumentAsync(Uri uri, bool excludeArchived, CancellationToken? cancellationToken = null);
		Task<FetchStreamsResponse> FetchStreamsAsync(FetchStreamsRequest request);
		Task TrackAsync(string key, TelemetryProperties properties = null);
	}

	[Injected]
	public class CodeStreamAgentService : ICodeStreamAgentService, SCodeStreamAgentService, IDisposable {
		private static readonly ILogger Log = LogManager.ForContext<CodeStreamAgentService>();
		private readonly IComponentModel _componentModel;
		public ISessionService SessionService { get; }
		private readonly ISettingsService _settingsService;
		private readonly IEventAggregator _eventAggregator;

		private JsonRpc _rpc;
		bool _disposed;

		public CodeStreamAgentService(IComponentModel componentModel,
			ISessionService sessionService,
			ISettingsService settingsService,
			IEventAggregator eventAggregator) {
			_componentModel = componentModel;
			SessionService = sessionService;
			_settingsService = settingsService;
			_eventAggregator = eventAggregator;
		}

		public Task SetRpcAsync(JsonRpc rpc) {
			_rpc = rpc;
			_rpc.Disconnected += Rpc_Disconnected;

			return Task.CompletedTask;
		}

		private void Rpc_Disconnected(object sender, JsonRpcDisconnectedEventArgs e) {
			Log.Debug(e.Exception, $"RPC Disconnected: {e.LastMessage} {e.Description}");
			SessionService.SetAgentDisconnected();
			_eventAggregator?.Publish(new LanguageServerDisconnectedEvent(e?.LastMessage, e?.Description, e?.Reason.ToString(), e?.Exception));
		}

		private Task<T> SendCoreAsync<T>(string name, object arguments, CancellationToken? cancellationToken = null) {
			cancellationToken = cancellationToken ?? CancellationToken.None;
			try {
				// the arguments might have sensitive data in it -- don't include arguments here
				using (Log.CriticalOperation($"name=REQ,Method={name}")) {
					return _rpc.InvokeWithParameterObjectAsync<T>(name, arguments, cancellationToken.Value);
				}
			}
			catch (Exception ex) {
				Log.Error(ex, "SendName={Name}", name);
				throw;
			}
		}

		public Task<T> SendAsync<T>(string name, object arguments, CancellationToken? cancellationToken = null) {
			if (!SessionService.IsReady) {
				if (Log.IsDebugEnabled()) {
					try {
#if DEBUG
						Log.Debug($"Agent not ready. Name={name}, Arguments={arguments?.ToJson()}");
#else
						Log.Debug($"Agent not ready. Name={name}");
#endif
					}
					catch (Exception ex) {
						Log.Warning(ex, nameof(SendAsync));
					}
				}

				return Task.FromResult(default(T));
			}

			return SendCoreAsync<T>(name, arguments, cancellationToken);
		}

		public Task<CreateDocumentMarkerPermalinkResponse> CreatePermalinkAsync(Range range, string uri, string privacy) {
			return SendAsync<CreateDocumentMarkerPermalinkResponse>(CreateDocumentMarkerPermalinkRequestType.MethodName, new CreateDocumentMarkerPermalinkRequest {
				Range = range,
				Uri = uri,
				Privacy = privacy
			});
		}

		public Task<FetchCodemarksResponse> GetMarkersAsync(string streamId) {
			return SendAsync<FetchCodemarksResponse>("codestream/fetchCodemarks", new FetchCodemarksRequest { StreamId = streamId });
		}

		public Task<DocumentMarkersResponse> GetMarkersForDocumentAsync(Uri uri, bool excludeArchived,
			CancellationToken? cancellationToken = null) {
			DocumentMarkersFilters filters = null;
			if (excludeArchived) {
				filters = new DocumentMarkersFilters() { ExcludeArchived = true };
			}
			return SendAsync<DocumentMarkersResponse>("codestream/textDocument/markers", new DocumentMarkersRequest {
				TextDocument = new TextDocumentIdentifier { Uri = uri.ToString() },
				Filters = filters
			}, cancellationToken);
		}

		public Task<GetDocumentFromKeyBindingResponse> GetDocumentFromKeyBindingAsync(int key) {
			return SendAsync<GetDocumentFromKeyBindingResponse>(GetDocumentFromKeyBindingRequestType.MethodName,
				new GetDocumentFromKeyBindingRequest { Key = key });
		}

		public Task<GetFileStreamResponse> GetFileStreamAsync(Uri uri) {
			return SendAsync<GetFileStreamResponse>("codestream/streams/fileStream", new GetFileStreamRequest {
				TextDocument = new TextDocumentIdentifier { Uri = uri.ToString() }
			});
		}

		public Task<GetPostResponse> GetPostAsync(string streamId, string postId) {
			return SendAsync<GetPostResponse>("codestream/post", new GetPostRequest {
				StreamId = streamId,
				PostId = postId
			});
		}

		public Task<GetStreamResponse> GetStreamAsync(string streamId) {
			return SendAsync<GetStreamResponse>("codestream/stream", new GetStreamRequest {
				StreamId = streamId
			});
		}

		public Task<GetUserResponse> GetUserAsync(string userId) {
			return SendAsync<GetUserResponse>("codestream/user", new GetUserRequest {
				UserId = userId
			});
		}

		public Task<CreatePostResponse> CreatePostAsync(string streamId, string threadId, string text) {
			return SendAsync<CreatePostResponse>("codestream/posts/create", new CreatePostRequest {
				StreamId = streamId,
				ParentPostId = threadId,
				Text = text
			});
		}

		public Task<CsDirectStream> CreateDirectStreamAsync(List<string> memberIds) {
			return SendAsync<CsDirectStream>("codestream/streams/createDirect", new CreateDirectStreamRequest {
				Type = StreamType.direct.ToString(),
				MemberIds = memberIds
			});
		}

		public Task<FetchStreamsResponse> FetchStreamsAsync(FetchStreamsRequest request) {
			return SendAsync<FetchStreamsResponse>("codestream/streams", new FetchStreamsRequest2 {
				Types = request.Types.Select(_ => _.ToString()).ToList(),
				MemberIds = request.MemberIds
			});
		}

		public Task TrackAsync(string eventName, TelemetryProperties properties) {
			try {
				return SendAsync<JToken>("codestream/telemetry", new TelemetryRequest {
					EventName = eventName,
					Properties = properties
				});
			}
			catch (Exception ex) {
				Log.Verbose(ex, $"Failed to send telemetry for {eventName}");
				return Task.CompletedTask;
			}
		}

		public Task<JToken> LoginViaTokenAsync(string email, string token, string serverUrl) {
			return SendCoreAsync<JToken>("codestream/login", new LoginViaAccessTokenRequest {
				Email = email,
				PasswordOrToken = new LoginAccessToken(email, serverUrl, token),
				ServerUrl = serverUrl,
				Extension = _settingsService.GetExtensionInfo(),
				Ide = _settingsService.GetIdeInfo(),
#if DEBUG
				TraceLevel = TraceLevel.Verbose.ToJsonValue(),
				IsDebugging = true
#else
                TraceLevel = _settingsService.TraceLevel.ToJsonValue()
#endif
			});
		}

		public Task<JToken> LoginViaOneTimeCodeAsync(string signupToken, string serverUrl) {
			return SendCoreAsync<JToken>("codestream/login", new LoginRequest {
				SignupToken = signupToken,
				ServerUrl = serverUrl,
				Extension = _settingsService.GetExtensionInfo(),
				Ide = _settingsService.GetIdeInfo(),
#if DEBUG
				TraceLevel = TraceLevel.Verbose.ToJsonValue(),
				IsDebugging = true
#else
                TraceLevel = _settingsService.TraceLevel.ToJsonValue()
#endif
			});
		}

		public Task<JToken> LoginAsync(string email, string password, string serverUrl) {
			var extensionInfo = _settingsService.GetExtensionInfo();
			var ideInfo = _settingsService.GetIdeInfo();

			return SendCoreAsync<JToken>("codestream/login", new LoginRequest {
				Email = email,
				PasswordOrToken = password,
				ServerUrl = serverUrl,
				Extension = extensionInfo,
				Ide = ideInfo,
#if DEBUG
				TraceLevel = TraceLevel.Verbose.ToJsonValue(),
				IsDebugging = true
#else
                TraceLevel = _settingsService.TraceLevel.ToJsonValue()
#endif
			});
		}

		public Task<JToken> LogoutAsync() {
			return SendAsync<JToken>("codestream/logout", new LogoutRequest());
		}

		public Task<DocumentFromMarkerResponse> GetDocumentFromMarkerAsync(DocumentFromMarkerRequest request) {
			return SendAsync<DocumentFromMarkerResponse>("codestream/textDocument/fromMarker", request);
		}

		public async Task<JToken> GetBootstrapAsync(Settings settings, JToken state = null, bool isAuthenticated = false) {
			var ideService = Package.GetGlobalService(typeof(SIdeService)) as IIdeService;
			var vslsEnabled = ideService?.QueryExtension(ExtensionKind.LiveShare) == true;

			// NOTE: this camelCaseSerializer is important because FromObject doesn't
			// serialize using the global camelCase resolver

			var capabilities = state?["capabilities"] != null ? state["capabilities"].ToObject<JObject>() : JObject.FromObject(new { });
			capabilities.Merge(new Capabilities {
				CodemarkApply = false,
				CodemarkCompare = false,
				EditorTrackVisibleRange = true,
				Services = new Models.Services {
					Vsls = vslsEnabled
				}
			}.ToJToken(), new JsonMergeSettings {
				MergeArrayHandling = MergeArrayHandling.Union
			});

			var capabilitiesObject = capabilities.ToObject<Capabilities>();

			if (!isAuthenticated) {
				var bootstrapAnonymous = new BootstrapPartialResponseAnonymous {
					Capabilities = capabilitiesObject,
					Configs = new Configs {
						Email = _settingsService.Email,
						Team = _settingsService.Team,
						ShowAvatars = _settingsService.ShowAvatars,
						ServerUrl = _settingsService.ServerUrl,
						TraceLevel = _settingsService.TraceLevel
					},
					Env = _settingsService.GetEnvironmentName(),
					Version = _settingsService.GetEnvironmentVersionFormatted()
				}.ToJToken();
#if DEBUG
				Log.Debug(bootstrapAnonymous?.ToString());
#endif
				return bootstrapAnonymous;
			}

			if (state == null) throw new ArgumentNullException(nameof(state));
			var bootstrapAuthenticated = await _rpc.InvokeWithParameterObjectAsync<JToken>(BootstrapRequestType.MethodName)
				.ConfigureAwait(false) as JObject;

			var editorService = _componentModel.GetService<IEditorService>();
			var editorContext = editorService.GetEditorContext();

			WebviewContext webviewContext;
			var teamId = state["teamId"].ToString();
			var userSettingsService = ServiceLocator.Get<SUserSettingsService, IUserSettingsService>();
			var userSettings = await userSettingsService?.TryGetWebviewContextAsync(teamId);
			if (userSettings != null) {
				webviewContext = userSettings;
			}
			else {
				webviewContext = new WebviewContext {
					HasFocus = true
				};
			}

			webviewContext.CurrentTeamId = teamId;
			if (!webviewContext.PanelStack.AnySafe()) {
				webviewContext.PanelStack = new List<string> { WebviewPanels.CodemarksForFile };
			}
			var bootstrapResponse = new BootstrapAuthenticatedResponse {
				Capabilities = capabilitiesObject,
				Configs = new Configs {
					Email = (string)state["email"],
					Team = settings.Options.Team,
					ShowAvatars = settings.Options.ShowAvatars,
					ServerUrl = settings.Options.ServerUrl,
					TraceLevel = _settingsService.TraceLevel
				},
				Context = webviewContext,
				EditorContext = editorContext,
				Session = new UserSession {
					UserId = state["userId"].ToString(),
				},
				Env = settings.Env,
				Version = settings.Version
			};

			var bootstrapResponseJson = bootstrapResponse.ToJToken();
			bootstrapAuthenticated?.Merge(bootstrapResponseJson);
#if DEBUG
			// only log the non-user bootstrap data -- it's too verbose
			if (bootstrapAuthenticated == null) {
				System.Diagnostics.Debugger.Break();
			}
			Log.Debug(bootstrapResponseJson?.ToString());
#endif
			return bootstrapAuthenticated;
		}

		public void Dispose() {
			Dispose(true);
			GC.SuppressFinalize(this);
		}

		protected virtual void Dispose(bool disposing) {
			if (_disposed)
				return;

			if (disposing) {
				if (_rpc != null) {
					_rpc.Disconnected -= Rpc_Disconnected;
				}
			}

			_disposed = true;
		}
	}
}
