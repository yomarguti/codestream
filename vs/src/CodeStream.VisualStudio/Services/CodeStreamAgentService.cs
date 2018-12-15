using CodeStream.VisualStudio.Models;
using Microsoft.VisualStudio.Shell;
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
        Task<object> SetRpcAsync(JsonRpc rpc);
        Task<T> SendAsync<T>(string name, object arguments, CancellationToken? cancellationToken = null);
        Task<GetMetadataResponse> GetMetadataAsync(string uri,
           CancellationToken? cancellationToken = null
        );

        Task<JToken> LoginViaTokenAsync(string signupToken, string serverUrl);
        Task<JToken> LoginAsync(string email, string password, string serverUrl);
        Task<BootstrapState> GetBootstrapAsync(StateResponse state);
    }

    public class GetMetadataResponse
    {
        public string Code { get; set; }
    }
    public class CodeStreamAgentService : ICodeStreamAgentService
    {
        static readonly ILogger log = LogManager.ForContext<CodeStreamAgentService>();
        private IAsyncServiceProvider _serviceProvider;
        public CodeStreamAgentService(IAsyncServiceProvider serviceProvider)
        {
            _serviceProvider = serviceProvider;
        }

        private JsonRpc _rpc { get; set; }

        public async Task<object> SetRpcAsync(JsonRpc rpc)
        {
            _rpc = rpc;
            return await SendAsync<object>("codeStream/cli/initialized", null);
        }

        public async Task<T> SendAsync<T>(string name, object arguments, CancellationToken? cancellationToken = null)
        {
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

        public async Task<GetMetadataResponse> GetMetadataAsync(string uri,          
            CancellationToken? cancellationToken = null
         )
        {
            return await SendAsync<GetMetadataResponse>("codeStream/post/prepareWithCode",
                new
                {
                    textDocument = new { uri = uri },
                    range = new { start = new { line = 1, character = 1 }, end = new { line = 6, character = 2 } },
                    dirty = false
                }, cancellationToken);
        }

        public async Task<JToken> LoginViaTokenAsync(string signupToken, string serverUrl)
        {
            return await SendAsync<JToken>("codeStream/cli/login",
                new
                {
                    serverUrl = serverUrl,
                    signupToken = signupToken,
                    team = (string)null,
                    teamId = (string)null,
                    extension = new
                    {
                        build = "0",
                        buildEnv = "0",
                        version = "0",
                        versionFormatted = "0",
                    },
                    traceLevel = "verbose"
                });
        }

        public async Task<JToken> LoginAsync(string email, string password, string serverUrl)
        {
            return await SendAsync<JToken>("codeStream/cli/login", new
            {
                email = email,
                passwordOrToken = password,
                serverUrl = serverUrl,
                signupToken = (string)null,
                team = (string)null,
                teamId = (string)null,
                extension = new
                {
                    build = "0",
                    buildEnv = "0",
                    version = "0",
                    versionFormatted = "0",
                },
                traceLevel = "verbose"
            });
        }

        public async Task<BootstrapState> GetBootstrapAsync(StateResponse state)
        {
            var repos = await _rpc.InvokeWithParameterObjectAsync<JToken>("codeStream/repos");
            var streams = await _rpc.InvokeWithParameterObjectAsync<JToken>("codeStream/streams");
            var teams = await _rpc.InvokeWithParameterObjectAsync<JToken>("codeStream/teams");
            var usersUnreads = await _rpc.InvokeWithParameterObjectAsync<JToken>("codeStream/users/me/unreads");
            var users = await _rpc.InvokeWithParameterObjectAsync<JToken>("codeStream/users");
            var usersPreferences = await _rpc.InvokeWithParameterObjectAsync<JToken>("codeStream/users/me/preferences");

            var bootstrapState = new BootstrapState
            {
                Capabilities = state.State.Capabilities,
                CurrentUserId = state.State.UserId,
                CurrentTeamId = state.State.TeamId,
                Configs = new Config()
                {
                    ServerUrl = state.State.ServerUrl,
                    Email = state.State.Email
                },
                Env = state.State.Environment,

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