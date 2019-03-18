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

        /// <summary>
        /// Local path seems return a string like /c:/foo
        /// </summary>
        /// <param name="uri"></param>
        /// <returns></returns>
        public static string ToLocalPath(this Uri uri)
        {
            return uri.LocalPath.TrimStart('/');
        }


        /// <summary>
        /// Creates a string from a uri usable by methods talking to vscode-uri components.
        /// Essentially, this lower cases the drive letter in a file uri
        /// </summary>
        /// <param name="uri"></param>
        /// <returns></returns>
        public static string FromUri(this Uri uri)
        {
            if (uri.Scheme == "file")
            {
                var result = "file:///";
                // skip the first segment
                for (var i = 1; i < uri.Segments.Length; i++)
                {
                    string t = uri.Segments[i];
                    if (t.EndsWith(@"%3A/"))
                    {
                        result += t.ToLower();
                    }
                    else
                    {
                        result += t;
                    }
                }
                return result;
            }

            return uri.ToString();
        }

        public static string ToUriString(this string uriLikeString)
        {
            return new Uri(uriLikeString, UriKind.RelativeOrAbsolute).FromUri();
        }
    }
}
