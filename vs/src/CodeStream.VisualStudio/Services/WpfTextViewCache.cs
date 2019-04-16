using CodeStream.VisualStudio.Annotations;
using Microsoft.VisualStudio.Text.Editor;
using System;
using System.Collections.Generic;
using System.Linq;

namespace CodeStream.VisualStudio.Services {
	public interface IWpfTextViewCache {
		void Add(string key, IWpfTextView wpfTextView);
		void Remove(string key, IWpfTextView wpfTextView);
		bool TryGetValue(string key, out IWpfTextView wpfTextView);

	}
	public interface SWpfTextViewCache { }

	[Injected]
	public class WpfTextViewCache : SWpfTextViewCache, IWpfTextViewCache {
		private static Dictionary<string, List<IWpfTextView>> _items =
			new Dictionary<string, List<IWpfTextView>>(StringComparer.InvariantCultureIgnoreCase);
		private static readonly object locker = new object();
		public bool TryGetValue(string key, out IWpfTextView wpfTextView) {
			lock (locker) {
				if (_items.TryGetValue(key, out List<IWpfTextView> textViews)) {
					if (textViews.Count() == 1) {
						wpfTextView = textViews[0];						
					}
					else {
						wpfTextView = textViews.Where(_ => _.HasAggregateFocus || _.IsMouseOverViewOrAdornments).FirstOrDefault() ?? textViews.FirstOrDefault();						
					}
					return wpfTextView != null;
				}
				wpfTextView = null;
				return false;
			}
		}

		public void Add(string key, IWpfTextView wpfTextView) {
			lock (locker) {
				if (!_items.TryGetValue(key, out List<IWpfTextView> textViews)) {
					textViews = new List<IWpfTextView>();
					_items.Add(key, textViews);
				}
				textViews.Add(wpfTextView);
			}
		}

		public void Remove(string key, IWpfTextView wpfTextView) {
			lock (locker) {
				if (_items.TryGetValue(key, out List<IWpfTextView> textViews)) {
					textViews.Remove(wpfTextView);
                    if(!textViews.Any()) {
						_items.Remove(key);
					}
				}               
			}
		}		 
	}	  
}
