using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Newtonsoft.Json.Serialization;
using System.Collections.Generic;
using System.Linq;

namespace CodeStream.VisualStudio.Extensions
{
    public static class StringExtensions
    {
        public static bool IsNotNullOrWhiteSpace(this string s) => 
            !string.IsNullOrWhiteSpace(s);

        public static bool IsNullOrWhiteSpace(this string s) => 
            string.IsNullOrWhiteSpace(s);

        public static bool EqualsIgnoreCase(this string one, string two) => 
            string.Equals(one, two, System.StringComparison.OrdinalIgnoreCase);
    }
}