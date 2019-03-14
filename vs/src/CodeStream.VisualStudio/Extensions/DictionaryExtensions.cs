using System.Collections;

namespace CodeStream.VisualStudio.Extensions
{
    public static class DictionaryExtensions
    {
        public static bool AnySafe(this IDictionary dictionary) => dictionary?.Count > 0;
    }
}
