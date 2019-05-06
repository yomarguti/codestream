using System;
using System.Windows.Input;

namespace CodeStream.VisualStudio.Commands {
	public abstract class BookmarkShortcutICommandBase : ICommand {
		public event EventHandler CanExecuteChanged {
			add { throw new NotSupportedException(); }
			remove { }
		}

		public bool CanExecute(object parameter) => true;
		protected abstract int Index { get; }

		/// <summary>
		/// object parameter is always null, UGH! 
		/// </summary>
		/// <param name="parameter"></param>
		public void Execute(object parameter) => BookmarkShortcutRegistration.GetBookmarkCommand(Index)?.Invoke();
	}

	public class BookmarkShortcut1Command : BookmarkShortcutICommandBase {
		protected override int Index { get; } = 1;
	}
	public class BookmarkShortcut2Command : BookmarkShortcutICommandBase {
		protected override int Index { get; } = 2;
	}
	public class BookmarkShortcut3Command : BookmarkShortcutICommandBase {
		protected override int Index { get; } = 3;
	}
	public class BookmarkShortcut4Command : BookmarkShortcutICommandBase {
		protected override int Index { get; } = 4;
	}
	public class BookmarkShortcut5Command : BookmarkShortcutICommandBase {
		protected override int Index { get; } = 5;
	}
	public class BookmarkShortcut6Command : BookmarkShortcutICommandBase {
		protected override int Index { get; } = 6;
	}
	public class BookmarkShortcut7Command : BookmarkShortcutICommandBase {
		protected override int Index { get; } = 7;
	}
	public class BookmarkShortcut8Command : BookmarkShortcutICommandBase {
		protected override int Index { get; } = 8;
	}
	public class BookmarkShortcut9Command : BookmarkShortcutICommandBase {
		protected override int Index { get; } = 9;
	}
}
