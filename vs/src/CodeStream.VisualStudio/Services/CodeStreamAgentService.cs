using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using Microsoft.VisualStudio.LanguageServer.Protocol;
using Microsoft.VisualStudio.Shell;
using Newtonsoft.Json.Linq;
using Serilog;
using StreamJsonRpc;
using System;
using System.Collections.Generic;
using System.ComponentModel.Composition;
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

	public interface ICodeStreamAgentServiceFactory {
		ICodeStreamAgentService Create();
	}

	[Export(typeof(ICodeStreamAgentServiceFactory))]
	[PartCreationPolicy(CreationPolicy.Shared)]
	public class CodeStreamAgentServiceFactory : ServiceFactory<ICodeStreamAgentService>, ICodeStreamAgentServiceFactory {
		[ImportingConstructor]
		public CodeStreamAgentServiceFactory([Import(typeof(SVsServiceProvider))] IServiceProvider serviceProvider) :
			base(serviceProvider) {

		}
	}

	public class OtcLoginRequest {
		public string Code { get; set; }
		public string TeamId { get; set; }
		public string Team { get; set; }
		public bool? Alias { get; set; }
	}

	public interface ICodeStreamAgentService {
		Task SetRpcAsync(JsonRpc rpc);
		Task<T> SendAsync<T>(string name, object arguments, CancellationToken? cancellationToken = null);
		Task<JToken> ReinitializeAsync();
		Task<CreateDocumentMarkerPermalinkResponse> CreatePermalinkAsync(Range range, string uri, string privacy);
		Task<GetDocumentFromKeyBindingResponse> GetDocumentFromKeyBindingAsync(int key);
		Task<CreatePostResponse> CreatePostAsync(string streamId, string threadId, string text);
		Task<GetFileStreamResponse> GetFileStreamAsync(Uri uri);
		Task<GetPostResponse> GetPostAsync(string streamId, string postId);
		Task<GetUserResponse> GetUserAsync(string userId);
		Task<GetStreamResponse> GetStreamAsync(string streamId);
		Task<CsDirectStream> CreateDirectStreamAsync(List<string> memberIds);
		Task<JToken> LoginViaTokenAsync(JToken token, string team, string teamId = null);
		Task<JToken> OtcLoginRequestAsync(OtcLoginRequest request);
		Task<JToken> LoginAsync(string email, string password, string serverUrl, string teamId);
		Task<JToken> LogoutAsync();
		Task<JToken> GetBootstrapAsync(Settings settings, JToken state = null, bool isAuthenticated = false);
		Task<FetchCodemarksResponse> GetMarkersAsync(string streamId);
		Task<DocumentFromMarkerResponse> GetDocumentFromMarkerAsync(DocumentFromMarkerRequest request);
		Task<DocumentMarkersResponse> GetMarkersForDocumentAsync(Uri uri, bool excludeArchived, CancellationToken? cancellationToken = null);
		Task<FetchStreamsResponse> FetchStreamsAsync(FetchStreamsRequest request);
		Task TrackAsync(string key, TelemetryProperties properties = null);
	}


	[Export(typeof(ICodeStreamAgentService))]
	[PartCreationPolicy(CreationPolicy.Shared)]
	public class CodeStreamAgentService : ICodeStreamAgentService, IDisposable {
		private static readonly ILogger Log = LogManager.ForContext<CodeStreamAgentService>();

		private readonly ISessionService _sessionService;
		private readonly IEventAggregator _eventAggregator;
		private readonly ISettingsServiceFactory _settingsServiceFactory;

		[ImportingConstructor]
		public CodeStreamAgentService(
			IEventAggregator eventAggregator,
			ISessionService sessionService,
			ISettingsServiceFactory settingsServiceFactory) {
			_eventAggregator = eventAggregator;
			_sessionService = sessionService;
			_settingsServiceFactory = settingsServiceFactory;
			try {
				if (_eventAggregator == null || _sessionService == null || settingsServiceFactory == null) {
					Log.Error($"_eventAggregatorIsNull={_eventAggregator == null},_sessionServiceIsNull={_sessionService == null},settingsServiceFactoryIsNull={settingsServiceFactory == null}");
				}
			}
			catch (Exception ex) {
				Log.Fatal(ex, nameof(CodeStreamAgentService));
			}
		}

		private JsonRpc _rpc;
		bool _disposed;

		public async Task SetRpcAsync(JsonRpc rpc) {
			_rpc = rpc;
			_rpc.Disconnected += Rpc_Disconnected;

			try {
				var initializationResult = await InitializeAsync();
				Log.Verbose(initializationResult?.ToString());
			}
			catch (Exception ex) {
				Log.Fatal(ex, nameof(SetRpcAsync));
				throw;
			}
		}

		private void Rpc_Disconnected(object sender, JsonRpcDisconnectedEventArgs e) {
			Log.Debug(e.Exception, $"RPC Disconnected: {e.LastMessage} {e.Description}");

			try {
				_sessionService.SetAgentDisconnected();
				_eventAggregator?.Publish(new LanguageServerDisconnectedEvent(e.LastMessage, e.Description, e.Reason.ToString(), e.Exception));
			}
			catch (Exception ex) {
				Log.Error(ex, nameof(Rpc_Disconnected));
			}
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
			if (!_sessionService.IsAgentReady) {
				if (Log.IsDebugEnabled()) {
					try {
#if DEBUG
						Log.Warning($"Agent not ready. Status={_sessionService.StateString} Name={name}, Arguments={arguments?.ToJson()}");
#else
						Log.Warning($"Agent not ready. Name={name}");
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

		public Task<JToken> ReinitializeAsync() {
			return InitializeAsync();
		}

		private Task<JToken> InitializeAsync() {
			var settingsManager = _settingsServiceFactory.Create();
			var extensionInfo = settingsManager.GetExtensionInfo();
			var ideInfo = settingsManager.GetIdeInfo();
			return SendCoreAsync<JToken>("codestream/onInitialized", new LoginRequest {
				ServerUrl = settingsManager.ServerUrl,
				Extension = extensionInfo,
				Ide = ideInfo,
#if DEBUG
				TraceLevel = TraceLevel.Verbose.ToJsonValue(),
				IsDebugging = true
#else
                TraceLevel = settingsManager.TraceLevel.ToJsonValue()
#endif
			});
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

		public Task<JToken> LoginViaTokenAsync(JToken token, string team, string teamId = null) {
			return SendCoreAsync<JToken>("codestream/login/token", new TokenLoginRequest {
				Token = token,
				Team = team,
				TeamId = teamId
			});
		}

		public Task<JToken> LoginAsync(string email, string password, string serverUrl, string teamId) {
			var settingsManager = _settingsServiceFactory.Create();
			return SendCoreAsync<JToken>(PasswordLoginRequestType.MethodName, new PasswordLoginRequest {
				Email = email,
				Password = password,
				Team = settingsManager?.Team,
				TeamId = teamId
			});
		}

		public Task<JToken> OtcLoginRequestAsync(OtcLoginRequest request) {
			return SendCoreAsync<JToken>("codestream/login/otc", request);
		}

		public async Task<JToken> LogoutAsync() {
			var response = await SendAsync<JToken>("codestream/logout", new LogoutRequest());
			await ReinitializeAsync();
			return response;
		}

		public Task<DocumentFromMarkerResponse> GetDocumentFromMarkerAsync(DocumentFromMarkerRequest request) {
			return SendAsync<DocumentFromMarkerResponse>("codestream/textDocument/fromMarker", request);
		}

		public async Task<JToken> GetBootstrapAsync(Settings settings, JToken state = null, bool isAuthenticated = false) {
			var componentModel = Package.GetGlobalService(typeof(SComponentModel)) as IComponentModel;
			var ideService = componentModel?.GetService<IIdeService>();
			var _settingsManager = _settingsServiceFactory.Create();
			var vslsEnabled = ideService?.QueryExtension(ExtensionKind.LiveShare) == true;

			// NOTE: this camelCaseSerializer is important because FromObject doesn't
			// serialize using the global camelCase resolver

			var capabilities = state?["capabilities"] != null ? state["capabilities"].ToObject<JObject>() : JObject.FromObject(new { });
			capabilities.Merge(new Capabilities {
				CodemarkApply = true,
				CodemarkCompare = true,
				EditorTrackVisibleRange = true,
				Services = new Models.Services {
					Vsls = vslsEnabled
				}
			}.ToJToken(), new JsonMergeSettings {
				MergeArrayHandling = MergeArrayHandling.Union
			});

			// TODO: Need to separate the agent caps from the IDE ones, so that we don't need to keep the model up to date (i.e. support agent passthrough)
			var capabilitiesObject = capabilities.ToObject<Capabilities>();

			if (!isAuthenticated) {
				var bootstrapAnonymous = new BootstrapPartialResponseAnonymous {
					Capabilities = capabilitiesObject,
					Configs = new Configs {
						Email = _settingsManager.Email,
						Team = _settingsManager.Team,
						ShowAvatars = _settingsManager.ShowAvatars,
						ServerUrl = _settingsManager.ServerUrl,
						TraceLevel = _settingsManager.TraceLevel
					},
					Env = _settingsManager.GetEnvironmentName(),
					Version = _settingsManager.GetEnvironmentVersionFormatted(),
					Context = new WebviewContext {
						HasFocus = true
					},
					Session = new UserSession() { }
				}.ToJToken();
#if DEBUG
				Log.Debug(bootstrapAnonymous?.ToString());
#endif
				return bootstrapAnonymous;
			}

			if (state == null) throw new ArgumentNullException(nameof(state));
			var bootstrapAuthenticated = await _rpc.InvokeWithParameterObjectAsync<JToken>(BootstrapRequestType.MethodName)
				.ConfigureAwait(false) as JObject;

			var editorService = componentModel?.GetService<IEditorService>();
			var editorContext = editorService?.GetEditorContext();

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
					TraceLevel = _settingsManager.TraceLevel
				},
				Context = webviewContext,
				EditorContext = editorContext,
				Session = new UserSession {
					UserId = state["userId"].ToString()					
				},
				Env = settings.Env,
				Version = settings.Version,
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

		private void Dispose(bool disposing) {
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
