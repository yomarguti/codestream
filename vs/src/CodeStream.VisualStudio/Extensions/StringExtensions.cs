using System.Globalization;

namespace CodeStream.VisualStudio.Extensions
{
    public static class StringExtensions
    {
        public static bool IsNullOrWhiteSpace(this string s) => 
            string.IsNullOrWhiteSpace(s);

        public static bool EqualsIgnoreCase(this string one, string two) => 
            string.Equals(one, two, System.StringComparison.OrdinalIgnoreCase);

        public static bool EndsWithIgnoreCase(this string str, string value) =>
            str?.EndsWith(value, true, CultureInfo.InvariantCulture) == true;
    }
}