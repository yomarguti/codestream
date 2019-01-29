using CodeStream.VisualStudio.Core;
using CodeStream.VisualStudio.UI.Glyphs;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.Text.Editor;
using Microsoft.VisualStudio.Text.Tagging;
using Microsoft.VisualStudio.Utilities;
using System.Collections.Generic;
using System.ComponentModel.Composition;
using System.Diagnostics;

namespace CodeStream.VisualStudio.UI.Taggers
{
    [Export(typeof(IViewTaggerProvider))]
    [ContentType(ContentTypes.Text)]
    [TagType(typeof(CodemarkGlyphTag))]
    [TextViewRole(PredefinedTextViewRoles.Interactive)]
    [TextViewRole(PredefinedTextViewRoles.Document)]
    internal class CodemarkTaggerProvider : IViewTaggerProvider
    {
        [Import]
        public ITextDocumentFactoryService TextDocumentFactoryService { get; set; }

        private static readonly List<string> TextViewRoles = new List<string>
        {
            PredefinedTextViewRoles.Interactive,
            PredefinedTextViewRoles.Document
        };

        public ITagger<T> CreateTagger<T>(ITextView textView, ITextBuffer buffer) where T : ITag
        {
            var wpfTextView = textView as IWpfTextView;

            if (wpfTextView == null)
                return null;

            if (textView.TextBuffer != buffer)
                return null;

            // only show for roles we care about
            if (!wpfTextView.Roles.ContainsAll(TextViewRoles)) return null;

            if (!TextDocumentFactoryService.TryGetTextDocument(buffer, out ITextDocument textDocument))
            {
                return null;
            }

            return textView.TextBuffer.Properties.GetOrCreateSingletonProperty(typeof(CodemarkTagger),
                () => new CodemarkTagger(textView, textDocument, buffer)) as ITagger<T>;
        }
    }
}