using CodeStream.VisualStudio.Annotations;
using System;
using System.Collections.Generic;
using System.Runtime.Serialization;

namespace CodeStream.VisualStudio.Services
{
    public interface SSessionService { }

    public interface ISessionService
    {
        User User { get; }
        Guid GetOrCreateSignupToken();
        void SetAgentReady();
        void SetUserLoggedIn(User user);
        void SetAgentDisconnected();
        string CurrentStreamId { get; set; }
        string CurrentThreadId { get; set; }
        List<string> PanelStack { get; set; }
        /// <summary>
        /// Session is ready when the agent has loaded and the user has logged in
        /// </summary>
        bool IsReady { get; }
        bool IsAgentReady { get; }
        void Logout();
        string LiveShareUrl { get; set; }
    }

    [Injected]
    public class SessionService : SSessionService, ISessionService, IDisposable
    {
        private SessionState _sessionState;
        private Guid _signupToken = Guid.Empty;
        public User User { get; private set; }
        public List<string> PanelStack { get; set; }

        bool _disposed = false;

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

        public void SetAgentDisconnected()
        {
            _sessionState = SessionState.Unknown;
        }

        public void SetUserLoggedIn(User user)
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

            User = user;
        }

        public void Logout()
        {
            _sessionState = SessionState.AgentReady;
        }

        public string CurrentStreamId { get; set; }
        public string CurrentThreadId { get; set; }

        public bool IsAgentReady => _sessionState == SessionState.AgentReady || IsReady;

        public bool IsReady => _sessionState == SessionState.Ready;

        public string LiveShareUrl { get; set; }

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
                _sessionState = SessionState.Unknown;
            }

            _disposed = true;
        }
    }

    public class User
    {
        public User(string id, string userName, string emailAddress, string teamName, int teamCount)
        {
            Id = id;
            UserName = userName;
            EmailAddress = emailAddress;
            TeamName = teamName;
            TeamCount = teamCount;
        }

        public string Id { get; }
        public string TeamName { get; }
        public string UserName { get; }
        public string EmailAddress { get; }
        public int TeamCount { get; set; }

        public bool HasSingleTeam() =>  TeamCount == 1;
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
        /// <summary>
        /// The LanguageServerProcess is ready
        /// </summary>
        AgentReady = 1 << 0,
        /// <summary>
        /// The user has authenticated
        /// </summary>
        UserLoggedIn = 1 << 1,
        Ready = AgentReady | UserLoggedIn
    }
}