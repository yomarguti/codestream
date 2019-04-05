using System.ComponentModel.Composition;
using Microsoft.VisualStudio.Text.Editor;
using Microsoft.VisualStudio.Utilities;

namespace CodeStream.VisualStudio.UI.Margins
{
    [Export(typeof(EditorOptionDefinition))]
    [Name(DocumentMarkScrollbarMarkersEnabledOption.Name)]
    public sealed class DocumentMarkScrollbarMarkersEnabledOption : WpfViewOptionDefinition<bool>
    {
        public const string Name = "DocumentMarkScrollbarMarkersEnabled";
        public readonly static EditorOptionKey<bool> OptionKey = new EditorOptionKey<bool>(DocumentMarkScrollbarMarkersEnabledOption.Name);

        public override bool Default { get { return true; } }

        public override EditorOptionKey<bool> Key { get { return DocumentMarkScrollbarMarkersEnabledOption.OptionKey; } }
    }
}
