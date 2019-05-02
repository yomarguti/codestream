using CodeStream.VisualStudio.Core;
using CodeStream.VisualStudio.Packages;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.Text.Editor;
using Microsoft.VisualStudio.Text.Tagging;
using Microsoft.VisualStudio.Utilities;
using System;
using System.Collections.Generic;
using System.ComponentModel.Composition;
using System.Linq;
using CodeStream.VisualStudio.UI.Extensions;

namespace CodeStream.VisualStudio.UI.Margins {
	[Export(typeof(IWpfTextViewMarginProvider))]
	[Name(PredefinedCodestreamNames.DocumentMarkTextViewMargin)]
	[Order(After = PredefinedMarginNames.Glyph)]
	[MarginContainer(PredefinedMarginNames.Left)]
	[ContentType(ContentTypes.Text)]
	[TextViewRole(PredefinedTextViewRoles.Interactive)]
	[TextViewRole(PredefinedTextViewRoles.Document)]
	[TextViewRole(PredefinedTextViewRoles.PrimaryDocument)]
	[TextViewRole(PredefinedTextViewRoles.Editable)]
	internal sealed class DocumentMarkMarginProvider : ICodeStreamMarginProvider {
		private readonly IViewTagAggregatorFactoryService _viewTagAggregatorFactoryService;
		private readonly Lazy<IGlyphFactoryProvider, IGlyphMetadata>[] _glyphFactoryProviders;

		[ImportingConstructor]
		public DocumentMarkMarginProvider(IViewTagAggregatorFactoryService viewTagAggregatorFactoryService,
			[ImportMany] IEnumerable<Lazy<IGlyphFactoryProvider, IGlyphMetadata>> glyphFactoryProviders) {
			_viewTagAggregatorFactoryService = viewTagAggregatorFactoryService;

			// only get _our_ glyph factory
			_glyphFactoryProviders = Orderer.Order(glyphFactoryProviders)
				.Where(_ => _.Metadata.Name == PredefinedCodestreamNames.DocumentMarkGlyphFactoryProvider).ToArray();
		}

		[Import]
		public ITextDocumentFactoryService TextDocumentFactoryService { get; set; }

		public IWpfTextViewMargin CreateMargin(IWpfTextViewHost wpfTextViewHost, IWpfTextViewMargin parent) {			
			if (wpfTextViewHost == null || !wpfTextViewHost.TextView.Roles.ContainsAll(TextViewRoles.DefaultRoles)) return null;
			if (!TextDocumentExtensions.TryGetTextDocument(TextDocumentFactoryService, wpfTextViewHost.TextView.TextBuffer, out var textDocument)) {
				return null;
			}

			TextViewMargin = new DocumentMarkMargin(
				_viewTagAggregatorFactoryService,
				_glyphFactoryProviders,
				wpfTextViewHost,
				Package.GetGlobalService(typeof(SSessionService)) as ISessionService,
				Package.GetGlobalService(typeof(SSettingsService)) as ISettingsService
			);

			return TextViewMargin;
		}

		public ICodeStreamWpfTextViewMargin TextViewMargin { get; private set; }
	}
}
