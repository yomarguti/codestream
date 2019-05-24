using CodeStream.VisualStudio.Services;
using Microsoft.VisualStudio.LanguageServer.Protocol;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace CodeStream.VisualStudio.UnitTests.Services {
	[TestClass]
	public class IdeServiceTests {
		[TestMethod]
		public void CreateContentDiff_SingleLine_Test() {
			var ideService = new IdeService();
			var result = ideService.ReplaceContent(@"beds", "er",
				new Range {
					Start = new Position(0, 2),
					End = new Position(0, 3)
				});
			Assert.AreEqual("beers\r\n", result);
		}

		[TestMethod]
		public void CreateContentDiff_MultiLine_Test() {
			var ideService = new IdeService();
			var currentContent =
"/*1111\r\n2twotwo2\r\n3threethree3\r\n4444\r\n5555*/\r\notherstuff";
			var codemarkCode =
"/*1111\r\n2222\r\n3333\r\n4444\r\n5555*/\r\n";
			var expected =
"/*1111\r\n2222\r\n3333\r\n4444\r\n5555*/\r\notherstuff";
			var result = ideService.ReplaceContent(currentContent, codemarkCode,
				new Range {
					Start = new Position(0, 0),
					End = new Position(4, 6)
				});
			Assert.AreEqual(expected, result);
		}
	}
}
