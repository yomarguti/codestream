using Microsoft.VisualStudio.Text.Editor;
using System.Windows;

namespace CodeStream.VisualStudio.Core.Models {
	public class OpenEditorResult {
		public bool Success { get; set; }
		public FrameworkElement VisualElement { get; set; }
		public IWpfTextView WpfTextView { get; set; }
	}
}
