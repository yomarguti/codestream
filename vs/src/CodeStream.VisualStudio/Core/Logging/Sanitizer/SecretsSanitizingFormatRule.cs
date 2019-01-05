using System.Text.RegularExpressions;
using CodeStream.VisualStudio.Extensions;

namespace CodeStream.VisualStudio.Core.Logging.Sanitizer
{
    public class SecretsSanitizingFormatRule : ISanitizingFormatRule
    {
        private static readonly Regex PasswordRegex =
            new Regex(@"""password"":""(.*?)""(,|(?=\}))", RegexOptions.Compiled | RegexOptions.IgnorePatternWhitespace);

        private static readonly Regex TokenRegex =
            new Regex(@"""token"":""(.*?)""(,|(?=\}))", RegexOptions.Compiled | RegexOptions.IgnorePatternWhitespace);

        public string Sanitize(string content)
        {
            if (content.IsNotNullOrWhiteSpace()) return content;

            content = PasswordRegex.Replace(content, @"""password"":""<hidden>""$2");
            content = TokenRegex.Replace(content, @"""token"":""<hidden>""$2");

            return content.TrimEnd('\r', '\n');
        }
    }
}