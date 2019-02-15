using System.ComponentModel.Composition;
using CodeStream.VisualStudio.Core;
using CodeStream.VisualStudio.UI.Margins;
using Microsoft.VisualStudio.Text.Editor;
using Microsoft.VisualStudio.Text.Tagging;
using Microsoft.VisualStudio.Utilities;

namespace CodeStream.VisualStudio.UI.Glyphs
{
    [Export(typeof(IGlyphFactoryProvider))]
    [Name(PredefinedCodestreamNames.CodemarkGlyphFactoryProvider)]
    [ContentType(ContentTypes.Text)]
    [TagType(typeof(CodemarkGlyphTag))]
    internal sealed class CodemarkGlyphFactoryProvider : IGlyphFactoryProvider
    {
        public IGlyphFactory GetGlyphFactory(IWpfTextView view, IWpfTextViewMargin margin)
        {
            // HACK? only return the factory for our custom margin?
            if (margin.GetType() != typeof(CodemarkTextViewMargin)) return null;

            return new CodemarkGlyphFactory();
        }
    }
}