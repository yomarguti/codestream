using System;
using CodeStream.VisualStudio.Core;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.Text.Editor;
using Microsoft.VisualStudio.Utilities;
using System.ComponentModel.Composition;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.UI.Extensions;
using Microsoft.VisualStudio.ComponentModelHost;

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
			try {
				var containerMarginAsVerticalScrollBar = containerMargin as IVerticalScrollBar;
				if (containerMarginAsVerticalScrollBar == null) return null;

				if (!wpfTextViewHost.TextView.HasValidRoles()) return null;
				if (!TextDocumentExtensions.TryGetTextDocument(TextDocumentFactoryService,
					wpfTextViewHost.TextView.TextBuffer, out var textDocument)) return null;

				var sessionService = (Package.GetGlobalService(typeof(SComponentModel)) as IComponentModel)
					?.GetService<ISessionService>();

				TextViewMargin = new DocumentMarkScrollbar(
					wpfTextViewHost,
					containerMarginAsVerticalScrollBar, sessionService
				);

				return TextViewMargin;
			}
			catch (Exception ex) {
				System.Diagnostics.Debug.WriteLine(ex);
#if DEBUG
				System.Diagnostics.Debugger.Break();
#endif
			}

			return null;
		}

		public ICodeStreamWpfTextViewMargin TextViewMargin { get; private set; }
	}
}
