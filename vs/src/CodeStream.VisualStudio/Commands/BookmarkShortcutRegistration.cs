using Microsoft.VisualStudio.Shell;
using System.Collections.Generic;
using System.ComponentModel.Design;

namespace CodeStream.VisualStudio.Commands { 
	public static class BookmarkShortcutRegistration {
		public static Dictionary<int, BookmarkShortcutCommand> Commands { get; private set; }
		private static readonly Dictionary<int, int> Map = new Dictionary<int, int> {
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

		public static async System.Threading.Tasks.Task InitializeAllAsync(AsyncPackage package) {
			// Switch to the main thread - the call to AddCommand requires UI thread.
			await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(package.DisposalToken);

			var commandService = await package.GetServiceAsync((typeof(IMenuCommandService))) as OleMenuCommandService;

			Commands = new Dictionary<int, BookmarkShortcutCommand>();
			for (var i = 1; i < 10; i++) {
				Commands.Add(i, new BookmarkShortcutCommand(commandService, i, Map[i]));
			}
		}

		public static BookmarkShortcutCommand GetBookmarkCommand(int index) {
			return Commands != null ? Commands[index] : null;
		}
	}
}
