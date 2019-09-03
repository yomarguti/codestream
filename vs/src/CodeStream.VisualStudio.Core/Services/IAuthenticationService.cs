using CodeStream.VisualStudio.Core.Models;

namespace CodeStream.VisualStudio.Core.Services {
	public interface IAuthenticationService {
		System.Threading.Tasks.Task LogoutAsync(SessionSignedOutReason reason);
	}
}
