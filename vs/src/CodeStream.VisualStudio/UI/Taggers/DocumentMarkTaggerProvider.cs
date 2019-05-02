using CodeStream.VisualStudio.Core;
using CodeStream.VisualStudio.Services;
using CodeStream.VisualStudio.UI.Glyphs;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.Text.Editor;
using Microsoft.VisualStudio.Text.Tagging;
using Microsoft.VisualStudio.Utilities;
using System.ComponentModel.Composition;
using CodeStream.VisualStudio.UI.Extensions;

namespace CodeStream.VisualStudio.UI.Taggers {
	[Export(typeof(IViewTaggerProvider))]
	[ContentType(ContentTypes.Text)]
	[TagType(typeof(DocumentMarkGlyphTag))]
	[TextViewRole(PredefinedTextViewRoles.Interactive)]
	[TextViewRole(PredefinedTextViewRoles.Document)]
	[TextViewRole(PredefinedTextViewRoles.PrimaryDocument)]
	[TextViewRole(PredefinedTextViewRoles.Editable)]
	internal class DocumentMarkTaggerProvider : IViewTaggerProvider {
		[Import]
		public ITextDocumentFactoryService TextDocumentFactoryService { get; set; }

		public ITagger<T> CreateTagger<T>(ITextView textView, ITextBuffer buffer) where T : ITag {
			var wpfTextView = textView as IWpfTextView;
			if (wpfTextView == null || textView.TextBuffer != buffer) return null;
			if (!wpfTextView.Roles.ContainsAll(TextViewRoles.DefaultRoles)) return null;
			if (!TextDocumentExtensions.TryGetTextDocument(TextDocumentFactoryService, textView.TextBuffer, out var textDocument)) return null;

			var sessionService = ServiceLocator.Get<SSessionService, ISessionService>();
			return textView.Properties.GetOrCreateSingletonProperty(typeof(DocumentMarkTagger),
				() => new DocumentMarkTagger(sessionService, textView, buffer)) as ITagger<T>;
		}
	}
}
