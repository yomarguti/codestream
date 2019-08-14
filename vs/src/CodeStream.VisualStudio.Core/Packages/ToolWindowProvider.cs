using System;
using CodeStream.VisualStudio.Core.Models;

namespace CodeStream.VisualStudio.Core.Packages {
	public interface IToolWindowProvider {
		bool? ToggleToolWindowVisibility(Guid toolWindowId);
		bool ShowToolWindowSafe(Guid toolWindowId);
		bool IsVisible(Guid toolWindowId);
	}

	public interface SToolWindowProvider { }

	public interface SOptionsDialogPageAccessor { }
	public interface IOptionsDialogPageAccessor {
		IOptionsDialogPage GetOptionsDialogPage();
	}

	public class OptionsDialogPageAccessor : IOptionsDialogPageAccessor, SOptionsDialogPageAccessor {
		private IOptionsDialogPage _optionsDialogPage;
		public OptionsDialogPageAccessor(IOptionsDialogPage optionsDialogPage) {
			_optionsDialogPage = optionsDialogPage;
		}
		public IOptionsDialogPage GetOptionsDialogPage() {
			return _optionsDialogPage;
		}
	}
}
