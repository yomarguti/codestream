using System;

namespace CodeStream.VisualStudio.Extensions
{
    public static class UriExtensions
    {
        public static bool EqualsIgnoreCase(this Uri src, Uri target)
        {
            if (src == null && target == null) return true;
            if (src == null) return false;
            if (target == null) return false;

            return src.ToString().EqualsIgnoreCase(target.ToString());
        }

        public static Uri ToUri(this string uriString, UriKind uriKind = UriKind.RelativeOrAbsolute)
        {
            return Uri.TryCreate(uriString, uriKind, out Uri result) ? result : null;
        }

        public static string ToLocalPath(this Uri uri)
        {
            return uri.LocalPath.TrimStart('/');
        }
    }
}
