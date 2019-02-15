using System;
using System.Collections.Generic;
using CodeStream.VisualStudio.Extensions;
using Microsoft.VisualStudio.Text.Editor;
using Microsoft.VisualStudio.Utilities;

namespace CodeStream.VisualStudio.UI
{
   public static class TextViewExtensions
    {
        public static void TryRemoveProperty(this IWpfTextView textView, string key)
        {
            textView.TextBuffer.Properties.TryRemoveProperty(key);
        }

        public static void TryRemoveProperty(this PropertyCollection collection, string key)
        {
            if (!collection.ContainsProperty(key)) return;

            collection.RemoveProperty(key);
        }

        public static bool TryDisposeProperty(this PropertyCollection collection, string key, bool removeProperty = true)
        {
            if (!collection.ContainsProperty(key)) return false;

            collection.GetProperty<List<IDisposable>>(key).Dispose();
            if (removeProperty)
            {
                collection.RemoveProperty(key);
            }

            return true;
        }
    }
}
