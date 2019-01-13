using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Credentials;
using Serilog;
using System;
using System.Threading.Tasks;

namespace CodeStream.VisualStudio.Services
{
    public interface SCredentialsService
    {
    }

    public interface ICredentialsService
    {
        Task<Tuple<string, string>> LoadAsync(Uri uri, string email);
        Task<bool> SaveAsync(Uri uri, string email, string secret);
        Task<bool> DeleteAsync(Uri uri, string email);
    }

    public abstract class CredentialsServiceBase
    {
        private static readonly ILogger Log = LogManager.ForContext<CredentialsServiceBase>();

        /// <summary>
        /// Normally, ToUpperInvariant is better -- but we should be ok, as this is a 1-way transform
        /// </summary>
        /// <param name="keys"></param>
        /// <remarks>>https://docs.microsoft.com/en-us/visualstudio/code-quality/ca1308-normalize-strings-to-uppercase?view=vs-2017</remarks>
        /// <returns></returns>
        protected virtual string FormatKey(params string[] keys)
        {
            return string.Join("|", keys).ToLowerInvariant();
        }

        protected virtual string GetKey(string key)
        {
            return $"{Application.Name}|" + key;
        }

        protected Task<Tuple<string, string>> LoadAsync(params string[] keys)
        {
            if (keys == null) throw new ArgumentNullException(nameof(keys));

            Log.Verbose(nameof(LoadAsync));
            Tuple<string, string> result = null;

            try
            {
                using (var credential = Credential.Load(GetKey(FormatKey(keys))))
                {
                    if (credential != null)
                    {
                        result = Tuple.Create(credential.Username, credential.Password);
                        Log.Verbose(nameof(LoadAsync) + ": found");
                    }
                }
            }
            catch (Exception ex)
            {
                Log.Warning(ex, "Could not load token");
            }

            return Task.FromResult(result);
        }

        protected Task<bool> SaveAsync(string userName, string secret, params string[] keys)
        {
            if (keys == null) throw new ArgumentNullException(nameof(keys));

            Log.Verbose(nameof(SaveAsync));

            try
            {
                Credential.Save(GetKey(FormatKey(keys)), userName, secret);
                return Task.FromResult(true);
            }
            catch (Exception ex)
            {
                Log.Warning(ex, "Could not save token");
            }

            return Task.FromResult(false);
        }

        protected Task<bool> DeleteAsync(params string[] keys)
        {
            if (keys == null) throw new ArgumentNullException(nameof(keys));

            Log.Verbose(nameof(DeleteAsync));

            try
            {
                Credential.Delete(GetKey(FormatKey(keys)));
                return Task.FromResult(true);
            }
            catch (Exception ex)
            {
                Log.Warning(ex, "Could not delete token");
            }

            return Task.FromResult(false);
        }
    }

    public class CredentialsService : CredentialsServiceBase, SCredentialsService, ICredentialsService
    {
        public Task<Tuple<string, string>> LoadAsync(Uri uri, string email)
        {
            return LoadAsync(uri.ToString(), email);
        }

        public Task<bool> SaveAsync(Uri uri, string email, string secret)
        {
            return SaveAsync(email, secret, uri.ToString(), email);
        }

        public Task<bool> DeleteAsync(Uri uri, string email)
        {
            return DeleteAsync(uri.ToString(), email);
        }
    }
}
