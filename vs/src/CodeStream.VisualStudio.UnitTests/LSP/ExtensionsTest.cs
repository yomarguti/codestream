using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace CodeStream.VisualStudio.UnitTests.LSP {
	[TestClass]
	public class ExtensionsTest {
		[TestMethod]
		public void ToLspUriStringTest() {
		Assert.AreEqual(@"file:///c%3A/Users/xul/code/foo/OptionsSample/src/Options/BaseOptionModel.cs",
				VisualStudio.LSP.Extensions.ToLspUriString(@"C:\Users\xul\code\foo\OptionsSample\src\Options\BaseOptionModel.cs"));
		}
	}
}
