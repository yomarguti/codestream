using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Credentials;
using CodeStream.VisualStudio.Extensions;
using Serilog;
using System;
using System.Threading.Tasks;

namespace CodeStream.VisualStudio.Services
{
    public interface SCredentialsService { }
    public interface ICredentialsService
    {
        Task<Tuple<string, string>> LoadAsync(Uri uri, string email);
        Task SaveAsync(Uri uri, string email, string secret);
        Task DeleteAsync(Uri uri, string email);
    }

    public class CredentialsService : ICredentialsService, SCredentialsService
    {
        private static readonly ILogger Log = LogManager.ForContext<CredentialsService>();
        
        /// <summary>
        /// Create a key for storage
        /// </summary>
        /// <param name="uri"></param>
        /// <param name="email"></param>
        /// <remarks>https://docs.microsoft.com/en-us/visualstudio/code-quality/ca1308-normalize-strings-to-uppercase?view=vs-2017</remarks>
        /// <remarks>CA1308: Normalize strings to uppercase. A small group of characters, when they are converted to lowercase, cannot make a round trip</remarks>
        /// <returns></returns>
        private string ToKey(Uri uri, string email) => $"{uri}|{email}".ToUpperInvariant();

        public Task<Tuple<string, string>> LoadAsync(Uri uri, string email)
        {
            Log.Verbose(nameof(LoadAsync));
            var key = GetKey(ToKey(uri, email));

            Tuple<string, string> result = null;

            using (var credential = Credential.Load(key))
            {
                if (credential != null)
                {
                    result = Tuple.Create(credential.Username, credential.Password);
                    Log.Verbose(nameof(LoadAsync) + ": found");
                }
            }

            return Task.FromResult(result);
        }

        public Task SaveAsync(Uri uri, string email, string secret)
        {
            Guard.ArgumentNotEmptyString(email, nameof(email));

            var key = GetKey(ToKey(uri, email));
            try
            {
                Credential.Save(key, email, secret);
            }
            catch (Exception)
            {
                Log.Warning(new Exception("Could not save token"), string.Empty);
            }

            return Task.CompletedTask;
        }

        public Task DeleteAsync(Uri uri, string email)
        {
            try
            {
                var key = GetKey(ToKey(uri, email));
                Credential.Delete(key);

                Log.Verbose(nameof(DeleteAsync));

            }
            catch (Exception)
            {
                Log.Warning(new Exception("Could not delete token"), string.Empty);
            }
            return Task.CompletedTask;
        }

        private static string GetKey(string key)
        {
            return $"{Application.Name}|" + key;
        }
    }
}
