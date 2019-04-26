using CodeStream.VisualStudio.Core;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.Text.Editor;
using Microsoft.VisualStudio.Utilities;
using System.ComponentModel.Composition;

namespace CodeStream.VisualStudio.UI.Margins {
	[Export(typeof(IWpfTextViewMarginProvider))]
	[MarginContainer(PredefinedMarginNames.VerticalScrollBar)]
	[Name(PredefinedCodestreamNames.DocumentMarkScrollbar)]
	[Order(After = PredefinedMarginNames.OverviewChangeTracking, Before = PredefinedMarginNames.OverviewMark)]
	[ContentType(ContentTypes.Text)]
	[TextViewRole(PredefinedTextViewRoles.Interactive)]
	[TextViewRole(PredefinedTextViewRoles.Document)]
	[TextViewRole(PredefinedTextViewRoles.PrimaryDocument)]
	[TextViewRole(PredefinedTextViewRoles.Editable)]
	// [DeferCreation(OptionName = MatchMarginEnabledOption.OptionName)]
	internal sealed class DocumentMarkScrollbarProvider : ICodeStreamMarginProvider {
#pragma warning disable 649
		[Export]
		[Name("DocumentMarkScrollbarAdornmentLayer")]
		[Order(After = PredefinedAdornmentLayers.Outlining, Before = PredefinedAdornmentLayers.Selection)]
		internal AdornmentLayerDefinition MatchLayerDefinition;
#pragma warning restore 649

		[Import]
		public ITextDocumentFactoryService TextDocumentFactoryService { get; set; }

		public IWpfTextViewMargin CreateMargin(IWpfTextViewHost wpfTextViewHost, IWpfTextViewMargin containerMargin) {
			var containerMarginAsVerticalScrollBar = containerMargin as IVerticalScrollBar;
			if (containerMarginAsVerticalScrollBar == null) return null;
			
			if (!wpfTextViewHost.TextView.Roles.ContainsAll(TextViewRoles.DefaultRoles)) return null;
			if (!TextDocumentExtensions.TryGetTextDocument(TextDocumentFactoryService, wpfTextViewHost.TextView.TextBuffer, out var textDocument)) return null;

			TextViewMargin = new DocumentMarkScrollbar(
				wpfTextViewHost,
				containerMarginAsVerticalScrollBar,
				Package.GetGlobalService(typeof(SSessionService)) as ISessionService
			);

			return TextViewMargin;
		}

		public ICodeStreamWpfTextViewMargin TextViewMargin { get; private set; }
	}
}
