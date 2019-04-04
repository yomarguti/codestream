using System;
using System.Collections.Generic;
using System.ComponentModel.Design;
using System.Threading;
using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.Shell;
using Serilog;

namespace CodeStream.VisualStudio.Commands {
	public class BookmarkShortcutCommands : CommandBase {
		private static readonly ILogger Log = LogManager.ForContext<BookmarkShortcutCommands>();

		public static async System.Threading.Tasks.Task InitializeAllAsync(AsyncPackage package) {
			// Switch to the main thread - the call to AddCommand in ToolWindow1Command's constructor requires UI thread.
			await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(package.DisposalToken);

			var commandService = await package.GetServiceAsync((typeof(IMenuCommandService))) as OleMenuCommandService;

			var commands = new List<BookmarkShortcutCommands>();
			for (var i = 0; i < 10; i++) {
				commands.Add(new BookmarkShortcutCommands(package, commandService, i));
			}
			Log.Verbose($"{commands.Count} {nameof(BookmarkShortcutCommands)}s");
		}

		private static readonly Dictionary<int, int> Map = new Dictionary<int, int> {
			{0, PackageIds.BookmarkCommand0CommandId },
			{1, PackageIds.BookmarkCommand1CommandId },
			{2, PackageIds.BookmarkCommand2CommandId },
			{3, PackageIds.BookmarkCommand3CommandId },
			{4, PackageIds.BookmarkCommand4CommandId },
			{5, PackageIds.BookmarkCommand5CommandId },
			{6, PackageIds.BookmarkCommand6CommandId },
			{7, PackageIds.BookmarkCommand7CommandId },
			{8, PackageIds.BookmarkCommand8CommandId },
			{9, PackageIds.BookmarkCommand9CommandId }
		};

		private BookmarkShortcutCommands(AsyncPackage package, OleMenuCommandService commandService, int index) : base(package) {
			commandService = commandService ?? throw new ArgumentNullException(nameof(commandService));
			if (!Map.ContainsKey(index)) throw new ArgumentException(nameof(index));

			commandService.AddCommand(new OleMenuCommand((sender, args) => {
				InvokeHandler(sender, new BookmarkShortcutEventArgs(args, index));
			}, new CommandID(PackageGuids.guidWebViewPackageCmdSet, Map[index])));
		}

		void InvokeHandler(object sender, BookmarkShortcutEventArgs args) {
			var codeStreamService = ServiceLocator.Get<SCodeStreamService, ICodeStreamService>();
			Log.Debug($"Handle {nameof(BookmarkShortcutCommands)} for {args.Index}");

			//look up ID from saved settings for this Index

			codeStreamService.ShowCodemarkAsync("", cancellationToken: CancellationToken.None);
		}

		class BookmarkShortcutEventArgs : EventArgs {
			public int Index { get; }
			public EventArgs OriginalEventArgs { get; }

			public BookmarkShortcutEventArgs(EventArgs ea, int i) {
				OriginalEventArgs = ea;
				Index = i;
			}
		}
	}
}
