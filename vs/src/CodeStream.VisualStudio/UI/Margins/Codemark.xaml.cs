using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Text.Editor;
using System;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using CodeStream.VisualStudio.Models;
using CodeStream.VisualStudio.Packages;

namespace CodeStream.VisualStudio.UI.Margins
{
    // ReSharper disable once RedundantExtendsListEntry
    public partial class Codemark : UserControl
    {
        private static int _heightBuffer = 5;
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

        Task<GetPostResponse> _postTask;

        Task<GetUserResponse> _userTask;

        protected override void OnMouseEnter(MouseEventArgs e)
        {
            base.OnMouseEnter(e);

            if (_postTask == null)
            {
                var agentService = Microsoft.VisualStudio.Shell.Package.GetGlobalService(typeof(SCodeStreamAgentService)) as ICodeStreamAgentService;
                Microsoft.VisualStudio.Shell.ThreadHelper.JoinableTaskFactory.Run(async delegate
                {
                    // ReSharper disable once PossibleNullReferenceException
                    _postTask = agentService.GetPostAsync(
                                  _viewModel.Marker.Codemark.StreamId,
                                  _viewModel.Marker.Codemark.PostId
                    );
                    _userTask = agentService.GetUserAsync(_viewModel.Marker.CreatorId);

                    await Task.WhenAll(_postTask, _userTask);
                    var postResponse = await _postTask;
                    var userResponse = await _userTask;

                    await Microsoft.VisualStudio.Shell.ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();

                    ToolTip = $"{userResponse.User.Name}, {postResponse.Post.CreateAtDateTime.TimeAgo()} ({postResponse.Post.CreateAtDateTime.ToDisplayDate()}) " +
                              $"{Environment.NewLine}{Environment.NewLine}" +
                              $"\t{_viewModel.Marker.Summary}" +
                              $"{Environment.NewLine}{Environment.NewLine}" +
                              $"Click to View {_viewModel.Marker.Codemark.Type}";
                });
            }
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
            if (_viewModel?.Marker?.Codemark == null)
            {
                return;
            }

            var toolWindowProvider = Microsoft.VisualStudio.Shell.Package.GetGlobalService(typeof(SToolWindowProvider)) as IToolWindowProvider;
            var codeStreamService = Microsoft.VisualStudio.Shell.Package.GetGlobalService(typeof(SCodeStreamService)) as ICodeStreamService;

            Microsoft.VisualStudio.Shell.ThreadHelper.JoinableTaskFactory.Run(async delegate
            {
                var post = await _postTask;
                // ReSharper disable once PossibleNullReferenceException
                toolWindowProvider.ShowToolWindow(Guids.WebViewToolWindowGuid);
                // ReSharper disable once PossibleNullReferenceException
                await codeStreamService.OpenCommentByThreadAsync(post.Post.StreamId, post.Post.Id);
            });
        }

        public void Reposition(IWpfTextView textView, int offset)
        {
            Canvas.SetLeft(this, 0);
            Canvas.SetTop(this, offset - textView.ViewportTop + Height - _heightBuffer);
        }
    }
}