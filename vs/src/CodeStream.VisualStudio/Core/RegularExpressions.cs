using System.Text.RegularExpressions;

namespace CodeStream.VisualStudio.Core
{
    public static class RegularExpressions
    {
        public static readonly Regex LiveShareUrl = new Regex(@"https:\/\/insiders\.liveshare\.vsengsaas\.visualstudio\.com\/join\?",
            RegexOptions.Compiled | RegexOptions.IgnoreCase);

        public static Regex Number = new Regex(@"^\d+$", RegexOptions.Compiled);
    }
}
