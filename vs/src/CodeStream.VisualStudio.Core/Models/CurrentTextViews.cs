using System.Collections.Generic;
using Microsoft.VisualStudio.Text.Editor;

namespace CodeStream.VisualStudio.Core.Models {
	public class CurrentTextViews {
		public object DocumentView { get; set; }
		public IEnumerable<ITextView> TextViews { get; set; }
	}
}
