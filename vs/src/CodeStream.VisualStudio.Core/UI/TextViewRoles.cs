using System.Collections.Generic;
using Microsoft.VisualStudio.Text.Editor;

namespace CodeStream.VisualStudio.Core.UI {
	public static class TextViewRoles {
		/// <summary>
		/// Only get textViews that we care about
		/// </summary>
		public static readonly List<string> DefaultRoles = new List<string> {
			PredefinedTextViewRoles.Interactive,
			PredefinedTextViewRoles.Document,
			PredefinedTextViewRoles.PrimaryDocument,
			PredefinedTextViewRoles.Editable
		};

		public static readonly List<string> InvalidRoles = new List<string> {
			"DIFF"
		};
	}
}
