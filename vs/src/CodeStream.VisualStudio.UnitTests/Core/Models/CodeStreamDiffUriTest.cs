using CodeStream.VisualStudio.Core.Models;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace CodeStream.VisualStudio.UnitTests.Core.Models {
	[TestClass]
	public class CodeStreamDiffUriTest {
		[TestMethod]
		[DataRow(@"c:/users/foo/code/codestream/codestream-diff/2asdf/1/repoId/left/codestream-diff/foo/bar/baz1.cs", true)]
		[DataRow(@"c:\users\foo\code\codestream\codestream-diff\2asdf\1\repoId\left\codestream-diff\foo\bar\baz1.cs", true)]
		[DataRow(@"codestream-diff/2asdf/1/repoId/left/codestream-diff/foo/bar/baz1.cs", true)]
		[DataRow(@"codestream-diff/1/repoId/left/codestream-diff/foo/bar/baz1.cs", false)]
		[DataRow(@"codestream-diff://2asdf/1/repoId/left/codestream-diff/foo/bar/baz1.cs", false)]
		[DataRow("", false)]
		[DataRow(null, false)]
		public void IsTempFileTest(string filePathPart, bool expected) {			
			Assert.AreEqual(expected, CodeStreamDiffUri.IsTempFile(filePathPart));
		}
		
		[DataRow(@"codestream-diff/reviewId/1/repoId/left/codestream-diff/foo/bar/baz1.cs", true)]
		[DataRow(@"codestream-diff/reviewId/undefined/repoId/left/codestream-diff/foo/bar/baz1.cs", true)]
		[DataRow(@"codestream-diff/1/repoId/left/codestream-diff/foo/bar/baz1.cs", false)]
		[DataRow(@"codestream-diff://2asdf/1/repoId/left/codestream-diff/foo/bar/baz1.cs", false)]
		[DataRow("", false)]
		[DataRow(null, false)]
		public void TryParseTest(string filePathPart, bool expected) {
			Assert.AreEqual(expected, CodeStreamDiffUri.TryParse(filePathPart, out CodeStreamDiffUri result));
		}
		
		[DataRow(@"codestream-diff/reviewId/undefined/repoId/left/codestream-diff/foo/bar/baz1.cs", "foo/bar/baz1.cs", true)]
		public void TryParseFileNameTest(string filePathPart, string fileName, bool expected) {
			Assert.AreEqual(expected, CodeStreamDiffUri.TryParse(filePathPart, out CodeStreamDiffUri result));
			Assert.AreEqual(fileName, result.FileName);
		}
	}
}
