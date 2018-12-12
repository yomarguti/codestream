using System;
using CodeStream.VisualStudio.Attributes;
using CodeStream.VisualStudio.Models;

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
        SessionState SessionState { get; set; }
    }

    [Injected]
    public class SessionService : SSessionService, ISessionService
    {
        private Microsoft.VisualStudio.OLE.Interop.IServiceProvider _serviceProvider;

        public LoginResponse LoginResponse { get; set; }
        public State State { get; set; }
        public BootstrapState BootstrapState { get; set; }
        public SessionState SessionState { get; set; }

        public SessionService(Microsoft.VisualStudio.OLE.Interop.IServiceProvider serviceProvider)
        {
            _serviceProvider = serviceProvider;
        }

        public Guid GenerateSignupToken()
        {
            return Guid.NewGuid();
        }
    }

    public enum SessionState
    {
        Unknown,
        AgentReady
    }
}