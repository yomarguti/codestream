using CodeStream.VisualStudio.Annotations;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Events;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.UI;
using Microsoft.VisualStudio.Shell;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Newtonsoft.Json.Serialization;
using Serilog;
using Serilog.Events;
using SerilogTimings.Extensions;
using StreamJsonRpc;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Task = System.Threading.Tasks.Task;
using TraceLevel = CodeStream.VisualStudio.Core.Logging.TraceLevel;

// ReSharper disable ClassNeverInstantiated.Global
// ReSharper disable UnusedAutoPropertyAccessor.Global

namespace CodeStream.VisualStudio.Services
{
    public interface SCodeStreamAgentService { }

    public interface ICodeStreamAgentService
    {
        Task SetRpcAsync(JsonRpc rpc);
        Task<T> SendAsync<T>(string name, object arguments, CancellationToken? cancellationToken = null);

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
        Task<DocumentMarkersResponse> GetMarkersForDocumentAsync(Uri uri, CancellationToken? cancellationToken = null);
        Task<FetchStreamsResponse> FetchStreamsAsync(FetchStreamsRequest request);
        Task TrackAsync(string key, TelemetryProperties properties = null);
    }

    [Injected]
    public class CodeStreamAgentService : ICodeStreamAgentService, SCodeStreamAgentService, IDisposable
    {
        private static readonly ILogger Log = LogManager.ForContext<CodeStreamAgentService>();
        private readonly ISessionService _sessionService;
        private readonly ISettingsService _settingsService;
        private readonly IEventAggregator _eventAggregator;
        private readonly IIdeService _ideService;

        private JsonRpc _rpc;
        bool _disposed;

        public CodeStreamAgentService(ISessionService sessionService, ISettingsService settingsService, IEventAggregator eventAggregator, IIdeService ideService)
        {
            _sessionService = sessionService;
            _settingsService = settingsService;
            _eventAggregator = eventAggregator;
            _ideService = ideService;
        }

        public Task SetRpcAsync(JsonRpc rpc)
        {
            _rpc = rpc;
            _rpc.Disconnected += Rpc_Disconnected;

            return Task.CompletedTask;
        }

        private void Rpc_Disconnected(object sender, JsonRpcDisconnectedEventArgs e)
        {
            Log.Verbose(e.Exception, $"RPC Disconnected: {e.LastMessage} {e.Description}");
            _sessionService.SetAgentDisconnected();
            _eventAggregator?.Publish(new LanguageServerDisconnectedEvent(e?.LastMessage, e?.Description, e?.Reason.ToString(), e?.Exception));
        }

        private Task<T> SendCoreAsync<T>(string name, object arguments, CancellationToken? cancellationToken = null)
        {
            cancellationToken = cancellationToken ?? CancellationToken.None;
            try
            {
                if (Log.IsEnabled(LogEventLevel.Verbose))
                {
                    // the args might have sensitive data in it -- don't include args here
                    using (Log.TimeOperation("SendCoreAsync. Name={Name}", name))
                    {
                        return _rpc.InvokeWithParameterObjectAsync<T>(name, arguments, cancellationToken.Value);
                    }
                }
                else
                {
                    return _rpc.InvokeWithParameterObjectAsync<T>(name, arguments, cancellationToken.Value);
                }
            }
            catch (Exception ex)
            {
                Log.Error(ex, "SendName={Name}", name);
                throw;
            }
        }

        public Task<T> SendAsync<T>(string name, object arguments, CancellationToken? cancellationToken = null)
        {
            if (!_sessionService.IsReady)
            {
                if (Log.IsEnabled(LogEventLevel.Verbose))
                {
                    try
                    {
                        Log.Verbose($"Agent not ready. Name={name}, Arguments={arguments?.ToJson()}");
                    }
                    catch (Exception ex)
                    {
                        Log.Verbose(ex, nameof(SendAsync));
                    }
                }

                return Task.FromResult(default(T));
            }

            return SendCoreAsync<T>(name, arguments, cancellationToken);
        }

        public Task<FetchCodemarksResponse> GetMarkersAsync(string streamId)
        {
            return SendAsync<FetchCodemarksResponse>("codestream/fetchCodemarks", new FetchCodemarksRequest { StreamId = streamId });
        }

        public Task<DocumentMarkersResponse> GetMarkersForDocumentAsync(Uri uri,
            CancellationToken? cancellationToken = null)
        {
            return SendAsync<DocumentMarkersResponse>("codestream/textDocument/markers", new DocumentMarkersRequest
            {
                TextDocument = new TextDocumentIdentifier { Uri = uri.ToString() }
            }, cancellationToken);
        }

        public Task<GetFileStreamResponse> GetFileStreamAsync(Uri uri)
        {
            return SendAsync<GetFileStreamResponse>("codestream/streams/fileStream", new GetFileStreamRequest
            {
                TextDocument = new TextDocumentIdentifier { Uri = uri.ToString() }
            });
        }

        public Task<GetPostResponse> GetPostAsync(string streamId, string postId)
        {
            return SendAsync<GetPostResponse>("codestream/post", new GetPostRequest
            {
                StreamId = streamId,
                PostId = postId
            });
        }

        public Task<GetStreamResponse> GetStreamAsync(string streamId)
        {
            return SendAsync<GetStreamResponse>("codestream/stream", new GetStreamRequest
            {
                StreamId = streamId
            });
        }

        public Task<GetUserResponse> GetUserAsync(string userId)
        {
            return SendAsync<GetUserResponse>("codestream/user", new GetUserRequest
            {
                UserId = userId
            });
        }

        public Task<CreatePostResponse> CreatePostAsync(string streamId, string threadId, string text)
        {
            return SendAsync<CreatePostResponse>("codestream/posts/create", new CreatePostRequest
            {
                StreamId = streamId,
                ParentPostId = threadId,
                Text = text
            });
        }

        public Task<CsDirectStream> CreateDirectStreamAsync(List<string> memberIds)
        {
            return SendAsync<CsDirectStream>("codestream/streams/createDirect", new CreateDirectStreamRequest
            {
                Type = StreamType.direct.ToString(),
                MemberIds = memberIds
            });
        }

        public Task<FetchStreamsResponse> FetchStreamsAsync(FetchStreamsRequest request)
        {
            return SendAsync<FetchStreamsResponse>("codestream/streams", new FetchStreamsRequest2
            {
                Types = request.Types.Select(_ => _.ToString()).ToList(),
                MemberIds = request.MemberIds
            });
        }

        public Task TrackAsync(string eventName, TelemetryProperties properties)
        {
            try
            {
                return SendAsync<JToken>("codestream/telemetry", new TelemetryRequest
                {
                    EventName = eventName,
                    Properties = properties
                });
            }
            catch (Exception ex)
            {
                Log.Verbose(ex, $"Failed to send telemetry for {eventName}");
                return Task.CompletedTask;
            }
        }

        public Task<JToken> LoginViaTokenAsync(string email, string token, string serverUrl)
        {
            return SendCoreAsync<JToken>("codestream/login", new LoginViaAccessTokenRequest
            {
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

        public Task<JToken> LoginViaOneTimeCodeAsync(string signupToken, string serverUrl)
        {
            return SendCoreAsync<JToken>("codestream/login", new LoginRequest
            {
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

        public Task<JToken> LoginAsync(string email, string password, string serverUrl)
        {
            var extensionInfo = _settingsService.GetExtensionInfo();
            var ideInfo = _settingsService.GetIdeInfo();

            return SendCoreAsync<JToken>("codestream/login", new LoginRequest
            {
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

        public Task<JToken> LogoutAsync()
        {
            return SendAsync<JToken>("codestream/logout", new LogoutRequest());
        }

        public Task<DocumentFromMarkerResponse> GetDocumentFromMarkerAsync(DocumentFromMarkerRequest request)
        {
            return SendAsync<DocumentFromMarkerResponse>("codestream/textDocument/fromMarker", request);
        }

        public async Task<JToken> GetBootstrapAsync(Settings settings, JToken state = null, bool isAuthenticated = false)
        {
            var ideService = Package.GetGlobalService(typeof(SIdeService)) as IIdeService;
            var vslsEnabled = ideService?.QueryExtension(ExtensionKind.LiveShare) == true;

            // this camelCaseSerializer is important because FromObject doesn't
            // serialize using the global camelCase resolver
            var camelCaseSerializer = JsonSerializer.Create(new JsonSerializerSettings
            {
                ContractResolver = new CamelCasePropertyNamesContractResolver()
            });

            var capabilities = state?["capabilities"] != null ? state["capabilities"].ToObject<JObject>() : JObject.FromObject(new { });
            capabilities.Merge(JObject.FromObject(new Capabilities
            {
                CodemarkApply = false,
                CodemarkCompare = false,
                EditorTrackVisibleRange = true,
                Services = new Models.Services
                {
                    Vsls = vslsEnabled
                }
            }, camelCaseSerializer), new JsonMergeSettings
            {
                MergeArrayHandling = MergeArrayHandling.Union
            });

            var capabilitiesObject = capabilities.ToObject<Capabilities>();

            if (!isAuthenticated)
            {
                var bootstrapAnonymous = JToken.FromObject(new BootstrapPartialResponseAnonymous
                {
                    Capabilities = capabilitiesObject,
                    Configs = new Configs
                    {
                        ServerUrl = _settingsService.ServerUrl,
                        Email = _settingsService.Email,
                        ShowHeadshots = _settingsService.ShowHeadshots,
                        ShowMarkers = _settingsService.ShowMarkers,
                        MuteAll = _settingsService.MuteAll,
                        Team = _settingsService.Team,
                        ViewCodemarksInline = _settingsService.ViewCodemarksInline
                    },
                    Env = _settingsService.GetEnvironmentName(),
                    Version = _settingsService.GetEnvironmentVersionFormatted()
                }, camelCaseSerializer);

                return bootstrapAnonymous;
            }

            if (state == null) throw new ArgumentNullException(nameof(state));

            var activeTextView = _ideService.GetActiveTextView();
            var editorState = _ideService.GetActiveEditorState();

            var bootstrapAuthenticated = await _rpc.InvokeWithParameterObjectAsync<JToken>(BootstrapRequestType.MethodName)
                .ConfigureAwait(false) as JObject;

            var bootstrapResponse = new BootstrapAuthenticatedResponse
            {
                Capabilities = capabilitiesObject,
                Configs = new Configs
                {
                    ServerUrl = settings.ServerUrl,
                    Email = state["email"].ToString(),
                    ShowMarkers = settings.ShowMarkers,
                    ShowHeadshots = settings.ShowHeadshots,
                    MuteAll = settings.MuteAll,
                    ViewCodemarksInline = settings.ViewCodemarksInline,
                    Team = settings.Team
                },
                Context = new WebviewContext
                {
                    CurrentTeamId = state["teamId"].ToString(),
                    //currentStreamId 
                    //threadId
                    HasFocus = true
                },
                EditorContext = new EditorContext
                {
                    //Scm
                    ActiveFile = activeTextView?.FilePath,
                    //LastActiveFile
                    TextEditorVisibleRanges = activeTextView?.TextView?.ToVisibleRanges(),
                    TextEditorUri = activeTextView?.Uri.ToString(),
                    TextEditorSelections = editorState.ToEditorSelections(),
                    Metrics = ThemeManager.CreateEditorMetrics(activeTextView?.TextView)
                },
                Session = new UserSession
                {
                    UserId = state["userId"].ToString(),
                },
                Env = settings.Env,
                Version = settings.Version
            };

            bootstrapAuthenticated?.Merge(JObject.FromObject(bootstrapResponse, camelCaseSerializer));

            return bootstrapAuthenticated;
        }

        public void Dispose()
        {
            Dispose(true);
            GC.SuppressFinalize(this);
        }

        protected virtual void Dispose(bool disposing)
        {
            if (_disposed)
                return;

            if (disposing)
            {
                if (_rpc != null)
                {
                    _rpc.Disconnected -= Rpc_Disconnected;
                }
            }

            _disposed = true;
        }
    }
}