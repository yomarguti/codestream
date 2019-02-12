using CodeStream.VisualStudio.Core;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Packages;
using CodeStream.VisualStudio.Services;
using System;
using System.Collections.Generic;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;

namespace CodeStream.VisualStudio.UI.Margins
{
    // ReSharper disable once RedundantExtendsListEntry
    public partial class Codemark : UserControl
    {
        private static int _defaultHeight = 19;
        private readonly CodemarkViewModel _viewModel;

        public Codemark(CodemarkViewModel viewModel)
        {
            //Default height used for repositioning in the margin
            Height = _defaultHeight;
            _viewModel = viewModel;
            InitializeComponent();
            DataContext = this;
            ImageUri = $"pack://application:,,,/CodeStream.VisualStudio;component/Resources/Assets/marker-{_viewModel.Marker.Codemark.Type}-{_viewModel.Marker.Codemark.Color}.png";
        }

        protected override void OnMouseEnter(MouseEventArgs e)
        {
            base.OnMouseEnter(e);

            ToolTip = $"{_viewModel.Marker.CreatorName}, {_viewModel.Marker.CreateAtDateTime.TimeAgo()} ({_viewModel.Marker.CreateAtDateTime.ToDisplayDate()}) " +
                      $"{Environment.NewLine}{Environment.NewLine}" +
                      $"\t{_viewModel.Marker.Summary}" +
                      $"{Environment.NewLine}{Environment.NewLine}" +
                      $"Click to View {_viewModel.Marker.Codemark.Type}";
        }

        public static readonly DependencyProperty ImageUriProperty =
            DependencyProperty.Register("ImageUri", typeof(string), typeof(Codemark));

        public static readonly DependencyProperty ImageTooltipProperty =
            DependencyProperty.Register("Tooltip", typeof(string), typeof(Codemark));

        // ReSharper disable once MemberCanBePrivate.Global
        public string ImageUri
        {
            get => (string)GetValue(ImageUriProperty);
            set => SetValue(ImageUriProperty, value);
        }

        // ReSharper disable once UnusedMember.Global
        public string Tooltip
        {
            get => (string)GetValue(ImageTooltipProperty);
            set => SetValue(ImageTooltipProperty, value);
        }

        private void Codemark_MouseDown(object sender, MouseButtonEventArgs e)
        {
            if (_viewModel?.Marker?.Codemark == null) return;

            var toolWindowProvider = Microsoft.VisualStudio.Shell.Package.GetGlobalService(typeof(SToolWindowProvider)) as IToolWindowProvider;
            var codeStreamService = Microsoft.VisualStudio.Shell.Package.GetGlobalService(typeof(SCodeStreamService)) as ICodeStreamService;

            if (toolWindowProvider == null || codeStreamService == null) return;

            toolWindowProvider.ShowToolWindow(Guids.WebViewToolWindowGuid);

            codeStreamService.OpenCommentByThreadAsync(_viewModel.Marker.PostStreamId ?? _viewModel.Marker.Codemark.StreamId, _viewModel.Marker.PostId ?? _viewModel.Marker.Codemark.PostId);

            codeStreamService.TrackAsync(TelemetryEventNames.CodemarkClicked, new Dictionary<string, object> { { "Codemark Location", "Source File" } });
        }
    }
}