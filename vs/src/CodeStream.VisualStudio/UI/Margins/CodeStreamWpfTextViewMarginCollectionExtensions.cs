using System.Collections.Generic;
using Microsoft.VisualStudio.Text.Editor;

namespace CodeStream.VisualStudio.UI.Margins
{
    public static class CodeStreamWpfTextViewMarginCollectionExtensions
    {
        public static void OnSessionReady(this List<ICodeStreamWpfTextViewMargin> items) =>
            items.ForEach(_ => _.OnSessionReady());

        public static void OnSessionLogout(this List<ICodeStreamWpfTextViewMargin> items) =>
            items.ForEach(_ =>
            {
                _.HideMargin();
                _.OnSessionLogout();
            });

        public static void Toggle(this List<ICodeStreamWpfTextViewMargin> items, bool isVisible)
            => items.ForEach(_ => _.ToggleMargin(isVisible));

        public static void Hide(this List<ICodeStreamWpfTextViewMargin> items) =>
            items.ForEach(_ => _.HideMargin());

        public static void OnMarkerChanged(this List<ICodeStreamWpfTextViewMargin> items)
            => items.ForEach(_ => _.OnMarkerChanged());

        public static void OnTextViewLayoutChanged(this List<ICodeStreamWpfTextViewMargin> items, object sender, TextViewLayoutChangedEventArgs e)
            => items.ForEach(_ => _.OnTextViewLayoutChanged(sender, e));
    }
}
