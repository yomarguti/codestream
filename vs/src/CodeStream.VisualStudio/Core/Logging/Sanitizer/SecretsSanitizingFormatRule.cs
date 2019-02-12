using CodeStream.VisualStudio.Extensions;

namespace CodeStream.VisualStudio.Core.Logging.Sanitizer
{
    public class SecretsSanitizingFormatRule : ISanitizingFormatRule
    {
        public string Sanitize(string content)
        {
            if (content.IsNullOrWhiteSpace()) return content;

            content = RegularExpressions.PasswordRegex.Replace(content, @"""password"":""<hidden>""$2");
            content = RegularExpressions.TokenRegex.Replace(content, @"""token"":""<hidden>""$2");
            content = RegularExpressions.PasswordOrTokenRegex.Replace(content, @"""passwordOrToken"":""<hidden>""$2");

            return content.TrimEnd('\r', '\n');
        }
    }
}