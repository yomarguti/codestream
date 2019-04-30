using Microsoft.VisualStudio.Text.Editor;
using System;
using System.Collections.Generic;
using System.ComponentModel.Composition;
using System.Linq;
using System.Runtime.InteropServices;

namespace CodeStream.VisualStudio.Services {
	[Guid("56467630-0C95-4CDE-857A-E59AC6FDB852")]
	public interface IWpfTextViewCache {
		void Add(string key, IWpfTextView wpfTextView);
		void Remove(string key, IWpfTextView wpfTextView);
		bool TryGetValue(string key, out IWpfTextView wpfTextView);
		int Count();
	}

	[Export(typeof(IWpfTextViewCache))]
	[PartCreationPolicy(CreationPolicy.Shared)]
	public class WpfTextViewCache : IWpfTextViewCache {
		private static readonly Dictionary<string, List<IWpfTextView>> Items =
			new Dictionary<string, List<IWpfTextView>>(StringComparer.InvariantCultureIgnoreCase);
		private static readonly object Locker = new object();

		public bool TryGetValue(string key, out IWpfTextView wpfTextView) {
			lock (Locker) {
				if (Items.TryGetValue(key, out List<IWpfTextView> textViews)) {
					if (textViews.Count() == 1) {
						wpfTextView = textViews[0];
					}
					else {
						wpfTextView = textViews.FirstOrDefault(_ => _.HasAggregateFocus || _.IsMouseOverViewOrAdornments) ?? textViews.FirstOrDefault();
					}
					return wpfTextView != null;
				}
				wpfTextView = null;
				return false;
			}
		}

		public void Add(string key, IWpfTextView wpfTextView) {
			lock (Locker) {
				if (!Items.TryGetValue(key, out List<IWpfTextView> textViews)) {
					textViews = new List<IWpfTextView>();
					Items.Add(key, textViews);
				}
				textViews.Add(wpfTextView);
			}
		}

		public void Remove(string key, IWpfTextView wpfTextView) {
			lock (Locker) {
				if (Items.TryGetValue(key, out List<IWpfTextView> textViews)) {
					textViews.Remove(wpfTextView);
					if (!textViews.Any()) {
						Items.Remove(key);
					}
				}
			}
		}

		public int Count() {
			lock (Locker) {
				return Items.Count;
			}
		}
	}
}
