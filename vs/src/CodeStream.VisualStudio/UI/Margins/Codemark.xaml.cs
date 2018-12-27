using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Text.Editor;
using System;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;

namespace CodeStream.VisualStudio.UI.Margins
{
    public partial class Codemark : UserControl
    {
        private static int HeightBuffer = 5;
        private static int DefaultHeight = 19;
        private readonly CodemarkViewModel _viewModel;

        public Codemark(CodemarkViewModel viewModel)
        {
            //Default height used for repositioning in the margin
            Height = DefaultHeight;
            _viewModel = viewModel;
            InitializeComponent();
            DataContext = this;
            ImageUri = $"pack://application:,,,/CodeStream.VisualStudio;component/Resources/Assets/marker-{_viewModel.Marker.Codemark.Type}-{_viewModel.Marker.Codemark.Color}.png";
        }

        System.Threading.Tasks.Task<GetPostResponse> _postTask;

        System.Threading.Tasks.Task<GetUserResponse> _userTask;

        protected override void OnMouseEnter(MouseEventArgs e)
        {
            base.OnMouseEnter(e);

            if (_postTask == null)
            {
                var agentService = Microsoft.VisualStudio.Shell.Package.GetGlobalService(typeof(SCodeStreamAgentService)) as ICodeStreamAgentService;
                Microsoft.VisualStudio.Shell.ThreadHelper.JoinableTaskFactory.Run(async delegate
                {
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
                              $"View {_viewModel.Marker.Codemark.Type}";
                });
            }
        }

        public static readonly DependencyProperty ImageUriProperty =
            DependencyProperty.Register("ImageUri", typeof(string), typeof(Codemark));

        public static readonly DependencyProperty ImageTooltipProperty =
       DependencyProperty.Register("Tooltip", typeof(string), typeof(Codemark));

        public string ImageUri
        {
            get { return (string)GetValue(ImageUriProperty); }
            set { SetValue(ImageUriProperty, value); }
        }

        public string Tooltip
        {
            get { return (string)GetValue(ImageTooltipProperty); }
            set { SetValue(ImageTooltipProperty, value); }
        }

        private void Codemark_MouseDown(object sender, System.Windows.Input.MouseButtonEventArgs e)
        {
            if (_viewModel == null || _viewModel.Marker == null || _viewModel.Marker.Codemark == null)
            {
                return;
            }

            var codeStreamService = Microsoft.VisualStudio.Shell.Package.GetGlobalService(typeof(SCodeStreamService)) as ICodeStreamService;

            Microsoft.VisualStudio.Shell.ThreadHelper.JoinableTaskFactory.Run(async delegate
            {
                var post = await _postTask;
                await codeStreamService.OpenCommentByThreadAsync(post.Post.StreamId, post.Post.Id);
            });
        }

        public void Reposition(IWpfTextView textView, int offset)
        {
            Canvas.SetLeft(this, 0);
            Canvas.SetTop(this, offset - textView.ViewportTop + Height - HeightBuffer);
        }
    }
}