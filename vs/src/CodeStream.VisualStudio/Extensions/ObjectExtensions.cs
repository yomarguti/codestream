using System.Collections.Generic;
using System.Linq;

namespace CodeStream.VisualStudio.Extensions
{
    public static class ObjectExtensions
    {
        public static int ToInt(this object o) => o == null ? 0 : int.Parse(o.ToString());

        /// <summary>
        /// Combines the items from list a and list b into a new list (c);
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="a"></param>
        /// <param name="b"></param>
        /// <returns></returns>
        public static List<T> Combine<T>(this List<T> a, List<T> b)
        {
            var c = new List<T>();

            c.AddRange(a);
            c.AddRange(b);

            return c;
        }

        public static bool AnySafe<T>(this List<T> a) => a != null && a.Any();
    }
}
