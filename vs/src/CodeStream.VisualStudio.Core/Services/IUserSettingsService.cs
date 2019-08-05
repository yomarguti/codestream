using System.Threading.Tasks;

namespace CodeStream.VisualStudio.Core.Services {
#pragma warning disable IDE1006 // Naming Styles
	public interface SUserSettingsService { }
#pragma warning restore IDE1006 // Naming Styles

	public interface IUserSettingsService {
		Task<T> TryGetValueAsync<T>(string bucketName, string dataKey);
		Task<bool> SaveAsync(string bucketName, string dataKey, object obj);
	}
}
