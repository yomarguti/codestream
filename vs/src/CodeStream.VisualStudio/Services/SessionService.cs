using CodeStream.VisualStudio.Attributes;
using CodeStream.VisualStudio.Models;
using Microsoft.VisualStudio.Shell;
using System;
using System.Runtime.Serialization;

namespace CodeStream.VisualStudio.Services
{
    public interface SSessionService
    {
    }

    public interface ISessionService
    {
        LoginResponse LoginResponse { get; set; }
        State State { get; set; }
        BootstrapState BootstrapState { get; set; }
        Guid GenerateSignupToken();
        AgentReadyScope AgentReady();
        void SetAgentReady();
        void SetUserReady();
        object Capabilities { get; set; }
        string CurrentStreamId { get; set; }
        bool IsReady { get; }

    }

    [Injected]
    public class SessionService : SSessionService, ISessionService
    {
        private IAsyncServiceProvider _serviceProvider;

        public LoginResponse LoginResponse { get; set; }
        public State State { get; set; }
        public BootstrapState BootstrapState { get; set; }
        private SessionState _sessionState;
        private Guid _signupToken = Guid.Empty;

        public SessionService(IAsyncServiceProvider serviceProvider)
        {
            _serviceProvider = serviceProvider;
        }

        public Guid GenerateSignupToken()
        {
            if (_signupToken == Guid.Empty)
            {
                _signupToken = Guid.NewGuid();
            }

            return _signupToken;
        }

        public AgentReadyScope AgentReady()
        {
            if (_sessionState != SessionState.AgentReady && _sessionState != SessionState.UserReady)
            {
                throw new AgentUninitializedException();
            }

            return new AgentReadyScope(_sessionState);
        }

        public object Capabilities { get; set; }

        public void SetAgentReady()
        {
            _sessionState = SessionState.AgentReady;
        }

        public void SetUserReady()
        {
            _sessionState = SessionState.UserReady;
        }

        public string CurrentStreamId { get; set; }
        public bool IsReady
        {
            get
            {
                return _sessionState == SessionState.UserReady;
            }
        }
    }

    public class AgentUninitializedException : Exception
    {
        public AgentUninitializedException()
        {
        }

        public AgentUninitializedException(string message) : base(message)
        {
        }

        public AgentUninitializedException(string message, Exception innerException) : base(message, innerException)
        {
        }

        protected AgentUninitializedException(SerializationInfo info, StreamingContext context) : base(info, context)
        {
        }
    }

    public class AgentReadyScope : IDisposable
    {
        public SessionState SessionState { get; set; }
        public AgentReadyScope(SessionState sessionState)
        {
            SessionState = SessionState;
        }

        public void Dispose()
        {

        }
    }

    public enum SessionState
    {
        Unknown,
        UserReady,
        AgentReady
    }
}