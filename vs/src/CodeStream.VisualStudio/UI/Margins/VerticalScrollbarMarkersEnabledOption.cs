using System.ComponentModel.Composition;
using Microsoft.VisualStudio.Text.Editor;
using Microsoft.VisualStudio.Utilities;

namespace CodeStream.VisualStudio.UI.Margins
{
    [Export(typeof(EditorOptionDefinition))]
    [Name(VerticalScrollbarMarkersEnabledOption.Name)]
    public sealed class VerticalScrollbarMarkersEnabledOption : WpfViewOptionDefinition<bool>
    {
        public const string Name = "VerticalScrollbarMarkersEnabled";
        public readonly static EditorOptionKey<bool> OptionKey = new EditorOptionKey<bool>(VerticalScrollbarMarkersEnabledOption.Name);

        public override bool Default { get { return true; } }

        public override EditorOptionKey<bool> Key { get { return VerticalScrollbarMarkersEnabledOption.OptionKey; } }
    }
}