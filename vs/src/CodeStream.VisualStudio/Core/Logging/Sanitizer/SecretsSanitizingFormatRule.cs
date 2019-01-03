using System.Text.RegularExpressions;

namespace CodeStream.VisualStudio.Core.Logging.Sanitizer
{
    public class SecretsSanitizingFormatRule : ISanitizingFormatRule
    {
        private static readonly Regex secretsRegex = new Regex(@"(""(token|password)"":)"".*?""", RegexOptions.Compiled | RegexOptions.IgnorePatternWhitespace);

        public string Sanitize(string content)
        {
            content = secretsRegex.Replace(content, m => m.Groups[1].Value + "\"<hidden>\"");
            return content.TrimEnd('\r','\n');
        }
    }
}