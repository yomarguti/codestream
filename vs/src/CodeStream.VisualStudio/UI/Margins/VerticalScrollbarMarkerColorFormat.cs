using System.ComponentModel.Composition;
using System.Windows.Media;
using Microsoft.VisualStudio.Text.Classification;
using Microsoft.VisualStudio.Utilities;

namespace CodeStream.VisualStudio.UI.Margins
{
    [Export(typeof(EditorFormatDefinition))]
    [Name(VerticalScrollbarMarkerColorFormat.Name)]
    [UserVisible(true)]
    [Order(Before = Priority.Default)]
    internal sealed class VerticalScrollbarMarkerColorFormat : EditorFormatDefinition
    {
        public const string Name = "VerticalScrollbarMarkerColor";

        public VerticalScrollbarMarkerColorFormat()
        {
            this.DisplayName = Name;
            this.ForegroundColor = Color.FromRgb(49, 147, 241);
        }
    }
}