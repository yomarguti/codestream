using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using CodeStream.VisualStudio.Core;
using CodeStream.VisualStudio.Core.Extensions;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Core.Models;
using CodeStream.VisualStudio.Core.Packages;
using CodeStream.VisualStudio.Core.Services;
using Microsoft.VisualStudio.ComponentModelHost;
using Serilog;

namespace CodeStream.VisualStudio.UI.Margins {
	// ReSharper disable once RedundantExtendsListEntry
	public partial class DocumentMark : UserControl {
		private static readonly ILogger Log = LogManager.ForContext<DocumentMark>();
		private static int _defaultHeight = 19;
		private readonly DocumentMarkViewModel _viewModel;

		public DocumentMark(DocumentMarkViewModel viewModel) {
			//Default height used for repositioning in the margin
			Height = _defaultHeight;
			_viewModel = viewModel;
			InitializeComponent();
			DataContext = this;
			string color = _viewModel.Marker.Codemark.Color;
			if (_viewModel.Marker.Codemark.Color.IsNullOrWhiteSpace()) {
				color = "blue";
				//this local warning is loud...
				//Log.LocalWarning($"Color missing for {_viewModel.Marker.Codemark.Id} Defaulting to {color}");
			}

			ImageUri = $"pack://application:,,,/CodeStream.VisualStudio;component/Resources/Assets/marker-{_viewModel.Marker.Codemark.Type}-{color}.png";
		}

		protected override void OnMouseEnter(MouseEventArgs e) {
			base.OnMouseEnter(e);

			ToolTip = $"{_viewModel.Marker.CreatorName}, {_viewModel.Marker.CreateAtDateTime.TimeAgo()} ({_viewModel.Marker.CreateAtDateTime.ToDisplayDate()}) " +
					  $"{Environment.NewLine}{Environment.NewLine}" +
					  $"\t{_viewModel.Marker.Summary}" +
					  $"{Environment.NewLine}{Environment.NewLine}" +
					  $"Click to View {_viewModel.Marker.Codemark.Type}";
		}

		public static readonly DependencyProperty ImageUriProperty =
			DependencyProperty.Register("ImageUri", typeof(string), typeof(DocumentMark));

		public static readonly DependencyProperty ImageTooltipProperty =
			DependencyProperty.Register("Tooltip", typeof(string), typeof(DocumentMark));

		// ReSharper disable once MemberCanBePrivate.Global
		public string ImageUri {
			get => (string)GetValue(ImageUriProperty);
			set => SetValue(ImageUriProperty, value);
		}

		// ReSharper disable once UnusedMember.Global
		public string Tooltip {
			get => (string)GetValue(ImageTooltipProperty);
			set => SetValue(ImageTooltipProperty, value);
		}

		private void DocumentMark_MouseDown(object sender, MouseButtonEventArgs e) {
			try {
				if (_viewModel?.Marker?.Codemark == null) return;

				if (!(Microsoft.VisualStudio.Shell.Package.GetGlobalService(typeof(SToolWindowProvider)) is IToolWindowProvider toolWindowProvider)) return;

				if (!(Microsoft.VisualStudio.Shell.Package.GetGlobalService(typeof(SComponentModel)) is IComponentModel componentModel)) {
					Log.Warning(nameof(componentModel));
					return;
				}
				var codeStreamService = componentModel.GetService<ICodeStreamService>();
				if (codeStreamService == null) return;

				toolWindowProvider.ShowToolWindowSafe(Guids.WebViewToolWindowGuid);

				var activeEditor = componentModel.GetService<IEditorService>()?.GetActiveTextEditor();
				_ = codeStreamService.ShowCodemarkAsync(_viewModel.Marker.Codemark.Id, activeEditor?.Uri.ToLocalPath());

				var codeStreamAgentService = componentModel.GetService<ICodeStreamAgentService>();
				if (codeStreamAgentService == null) return;

				_ = codeStreamAgentService.TrackAsync(TelemetryEventNames.CodemarkClicked, new TelemetryProperties {{"Codemark Location", "Source File"}});
			}
			catch (Exception ex) {
				Log.Error(ex, nameof(DocumentMark_MouseDown));
			}
		}
	}
}
