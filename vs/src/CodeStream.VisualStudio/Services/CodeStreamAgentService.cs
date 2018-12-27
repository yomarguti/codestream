using CodeStream.VisualStudio.Core;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Models;
using Microsoft.VisualStudio.Shell;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Serilog;
using StreamJsonRpc;
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace CodeStream.VisualStudio.Services
{
    public interface SCodeStreamAgentService
    {

    }

    public interface ICodeStreamAgentService
    {
        bool IsReady { get; }
        System.Threading.Tasks.Task SetRpcAsync(JsonRpc rpc);
        Task<T> SendAsync<T>(string name, object arguments, CancellationToken? cancellationToken = null);
        Task<GetMetadataResponse> GetMetadataAsync(string uri, Range range,
           CancellationToken? cancellationToken = null
        );

        Task<JToken> LoginViaTokenAsync(string signupToken, string serverUrl);
        Task<JToken> LoginAsync(string email, string password, string serverUrl);
        Task<BootstrapState> GetBootstrapAsync(State state, Settings settings);
        Task<FetchCodemarksResponse> GetMarkersAsync(string streamId);
        Task<DocumentFromMarkerResponse> GetDocumentFromMarkerAsync(DocumentFromMarkerRequest request);
        Task<DocumentMarkersResponse> GetMarkersForDocumentAsync(FileUri uri, CancellationToken? cancellationToken = null);
    }

    public class GetMetadataResponse
    {
        public string Code { get; set; }
        public string GitError { get; set; }
        public Source Source { get; set; }
    }

    public class FetchCodemarksResponse
    {
        public List<CSMarker> Markers { get; set; }
        public List<CSFullCodemark> Codemarks { get; set; }
    }

    public class DocumentMarkersResponse
    {
        public List<CSFullMarker> Markers { get; set; }
        public List<MarkerNotLocated> MarkersNotLocated { get; set; }
    }
   
    public class LoginRequest
    {
        
        public string ServerUrl { get; set; }        
        public string Email { get; set; }        
        public string PasswordOrToken { get; set; }        
        public string SignupToken { get; set; }        
        public string Type { get; set; }        
        public string Team { get; set; }        
        public string TeamId { get; set; }      
        public Extension Extension { get; set; }      
        public IDE Ide { get; set; }        
        public string TraceLevel { get; set; }
    }

    public class TextDocumentIdentifier
    {
        public string Uri { get; set; }
    }

    public class DocumentFromMarkerRequest
    {
        public string File { get; set; }
        public string RepoId { get; set; }
        public string MarkerId { get; set; }
        public string Source { get; set; }
    }

    public class DocumentFromMarkerResponse
    {
        public TextDocumentIdentifier TextDocument { get; set; }
        public CSRange Range { get; set; }
        public string Revision { get; set; }
    }

    public class CodeStreamAgentService : ICodeStreamAgentService
    {
        static readonly ILogger log = LogManager.ForContext<CodeStreamAgentService>();
        private readonly IAsyncServiceProvider _serviceProvider;
        public CodeStreamAgentService(IAsyncServiceProvider serviceProvider)
        {
            _serviceProvider = serviceProvider;
        }

        public bool IsReady { get; private set; }
        private JsonRpc _rpc { get; set; }

        public async System.Threading.Tasks.Task SetRpcAsync(JsonRpc rpc)
        {
            await System.Threading.Tasks.Task.Yield();
            _rpc = rpc;

            IsReady = true;
        }

        public async Task<T> SendAsync<T>(string name, object arguments, CancellationToken? cancellationToken = null)
        {
            if (!IsReady)
            {
                return default(T);
            }

            cancellationToken = cancellationToken ?? CancellationToken.None;
            try
            {
                return await _rpc.InvokeWithParameterObjectAsync<T>(name, arguments, cancellationToken.Value);
            }
            catch (Exception ex)
            {
                log.Error(ex, "SendAsync Name={Name}", name);
                throw;
            }
        }

        public async Task<FetchCodemarksResponse> GetMarkersAsync(string streamId)
        {
            return await SendAsync<FetchCodemarksResponse>("codeStream/fetchCodemarks", new { streamId = streamId });
        }

        public async Task<DocumentMarkersResponse> GetMarkersForDocumentAsync(FileUri uri,
            CancellationToken? cancellationToken = null)
        {            
            return await SendAsync<DocumentMarkersResponse>("codeStream/textDocument/markers", new
            {
                textDocument = new { uri = uri.ToString() }
            }, cancellationToken);
        }

        public async Task<GetMetadataResponse> GetMetadataAsync(string uri,
            Range range,
            CancellationToken? cancellationToken = null
         )
        {
            return await SendAsync<GetMetadataResponse>("codeStream/post/prepareWithCode",
                new
                {
                    textDocument = new { uri = uri },
                    range = new
                    {
                        start = new { line = range.StartLine, character = range.StartCharacter },
                        end = new { line = range.EndLine, character = range.EndCharacter }
                    },
                    dirty = false
                }, cancellationToken);
        }

        public async Task<JToken> LoginViaTokenAsync(string signupToken, string serverUrl)
        {
            return await SendAsync<JToken>("codeStream/cli/login", new LoginRequest
                {
                    SignupToken = signupToken,
                    ServerUrl = serverUrl,                    
                    Type = "otc",                    
                    Extension = Application.Extension,
                    Ide = Application.Ide,
                    TraceLevel = "verbose"
                });
        }

        public async Task<JToken> LoginAsync(string email, string password, string serverUrl)
        {
            return await SendAsync<JToken>("codeStream/cli/login", new LoginRequest
            {
                Email = email,
                PasswordOrToken = password,
                ServerUrl = serverUrl,
                Type = "credentials",                                              
                Extension = Application.Extension,
                Ide = Application.Ide,
                TraceLevel = "verbose"
            });
        }

        public async Task<DocumentFromMarkerResponse> GetDocumentFromMarkerAsync(DocumentFromMarkerRequest request)
        {
            return await SendAsync<DocumentFromMarkerResponse>("codeStream/textDocument/fromMarker", new 
            {
                file = request.File,
                repoId = request.RepoId,
                markerId = request.MarkerId,
                source = request.Source
            });
        }

        public async Task<BootstrapState> GetBootstrapAsync(State state, Settings settings)
        {
            var repos = await _rpc.InvokeWithParameterObjectAsync<JToken>("codeStream/repos");
            var streams = await _rpc.InvokeWithParameterObjectAsync<JToken>("codeStream/streams");
            var teams = await _rpc.InvokeWithParameterObjectAsync<JToken>("codeStream/teams");
            var usersUnreads = await _rpc.InvokeWithParameterObjectAsync<JToken>("codeStream/users/me/unreads");
            var users = await _rpc.InvokeWithParameterObjectAsync<JToken>("codeStream/users");
            var usersPreferences = await _rpc.InvokeWithParameterObjectAsync<JToken>("codeStream/users/me/preferences");

            var bootstrapState = new BootstrapState
            {
                Capabilities = state.Capabilities,
                CurrentUserId = state.UserId,
                CurrentTeamId = state.TeamId,
                Configs = new Config()
                {
                    ServerUrl = settings.ServerUrl,
                    Email = state.Email,
                    ShowMarkers = settings.ShowMarkers
                },
                Env = state.Environment,

                Repos = repos.Value<JToken>("repos").ToObject<List<CSRepository>>(),
                Streams = streams.Value<JToken>("streams").ToObject<List<CSStream>>(),
                Teams = teams.Value<JToken>("teams").ToObject<List<Team>>(),
                Unreads = usersUnreads.Value<JToken>("unreads").ToObject<CSUnreads>(),
                Users = users.Value<JToken>("users").ToObject<List<CSUser>>(),
                Services = new Service()
                {
                    //TODO
                    Vsls = false
                }
            };

            return bootstrapState;
        }
    }
}