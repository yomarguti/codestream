using CodeStream.VisualStudio.Annotations;
using CodeStream.VisualStudio.Models;
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
        Guid GetOrCreateSignupToken();
        void SetAgentReady();
        void SetUserLoggedIn();
        string CurrentStreamId { get; set; }
        /// <summary>
        /// Session is ready when the agent has loaded and the user has logged in
        /// </summary>
        bool IsReady { get; }
        bool IsAgentReady { get; }
        void Logout();
    }

    [Injected]
    public class SessionService : SSessionService, ISessionService
    {
        public LoginResponse LoginResponse { get; set; }
        public State State { get; set; }

        private SessionState _sessionState;
        private Guid _signupToken = Guid.Empty;

        public Guid GetOrCreateSignupToken()
        {
            if (_signupToken == Guid.Empty)
            {
                _signupToken = Guid.NewGuid();
            }

            return _signupToken;
        }

        public void SetAgentReady()
        {
            if (_sessionState != SessionState.Unknown)
                throw new SessionStateException("Origin state is invalid");

            _sessionState = SessionState.AgentReady;
        }

        public void SetUserLoggedIn()
        {
            if (_sessionState == SessionState.Ready)
            {
                // misc. errors after login wont kick the state back in the webview
                _sessionState = SessionState.AgentReady;
            }

            if (_sessionState == SessionState.AgentReady)
            {
                _sessionState = _sessionState | SessionState.UserLoggedIn;
            }
            else
            {
                throw new SessionStateException("Agent is not ready");
            }
        }

        public void Logout()
        {
            _sessionState = SessionState.AgentReady;
        }

        public string CurrentStreamId { get; set; }

        public bool IsAgentReady => _sessionState == SessionState.AgentReady || IsReady;

        public bool IsReady => _sessionState == SessionState.Ready;
    }

    [Serializable]
    public class SessionStateException : Exception
    {
        public SessionStateException() { }

        public SessionStateException(string message) : base(message) { }

        public SessionStateException(string message, Exception innerException) : base(message, innerException) { }

        protected SessionStateException(SerializationInfo info, StreamingContext context) : base(info, context) { }
    }

    [Flags]
    public enum SessionState
    {
        Unknown = 0,
        AgentReady = 1 << 0,
        UserLoggedIn = 1 << 1,
        Ready = AgentReady | UserLoggedIn
    }
}