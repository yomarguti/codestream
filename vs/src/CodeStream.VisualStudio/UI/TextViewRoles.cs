using Microsoft.VisualStudio.Text.Editor;
using System.Collections.Generic;

namespace CodeStream.VisualStudio.UI {
	public static class TextViewRoles {
		/// <summary>
		/// Only get textviews that we care about
		/// </summary>
		public static readonly List<string> DefaultRoles = new List<string>
	   {
			PredefinedTextViewRoles.Interactive,
			PredefinedTextViewRoles.Document,
			PredefinedTextViewRoles.PrimaryDocument,
			PredefinedTextViewRoles.Editable
		};
	}
}
