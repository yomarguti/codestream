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

        //[Export(typeof(ICredentialsService))]
        //[PartCreationPolicy(CreationPolicy.Shared)]

        private string ToKey(Uri uri, string email) => $"{uri}|{email}".ToLowerInvariant();

        public Task<Tuple<string, string>> LoadAsync(Uri uri, string email)
        {
            Log.Verbose(nameof(CredentialsService) + "-" + nameof(LoadAsync));
            var key = GetKey(ToKey(uri, email));

            Tuple<string, string> result = null;

            using (var credential = Credential.Load(key))
            {
                if (credential != null)
                {
                    result = Tuple.Create(credential.Username, credential.Password);
                    Log.Verbose(nameof(CredentialsService) + "-" + nameof(LoadAsync) + ": found");
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

                Log.Verbose(nameof(CredentialsService) + "-" + nameof(DeleteAsync));

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
