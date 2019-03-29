using CodeStream.VisualStudio.Extensions;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using System.Drawing;
using System.Globalization;
using System.Threading;

namespace CodeStream.VisualStudio.UnitTests.Extensions {
	[TestClass]
	public class ColorExtensionsTest {
		[TestMethod]
		public void ToRgbaTest() {

			CultureInfo currentCulture = null;
			try {
				currentCulture = Thread.CurrentThread.CurrentCulture;
				var culture = new CultureInfo("ru-RU");

				CultureInfo.DefaultThreadCurrentCulture = culture;
				CultureInfo.DefaultThreadCurrentUICulture = culture;

				Assert.AreEqual("ru-RU", CultureInfo.DefaultThreadCurrentCulture.ToString());
				Assert.AreEqual("rgba(255, 0, 0, 0.392156862745098)", Color.FromArgb(100, 255, 0, 0).ToRgba());
			}
			finally {
				CultureInfo.DefaultThreadCurrentCulture = currentCulture;
				CultureInfo.DefaultThreadCurrentUICulture = currentCulture;

				Assert.AreNotEqual("ru-RU", currentCulture.ToString());
			}
		}
	}
}
