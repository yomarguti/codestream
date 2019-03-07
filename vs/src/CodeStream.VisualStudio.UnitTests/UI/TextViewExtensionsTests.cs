using CodeStream.VisualStudio.Extensions;
using Microsoft.VisualStudio.LanguageServer.Protocol;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using System.Collections.Generic;

namespace CodeStream.VisualStudio.UnitTests.UI
{
    [TestClass]
    public class TextViewExtensionsTests
    {
        [TestMethod]
        public void RangeCollapsedTest0()
        {
            var positions = new List<Range>
            {
                new Range {Start = new Position {Line = 0}, End = new Position {Line = 0},},
                new Range {Start = new Position {Line = 1}, End = new Position {Line = 1},},
                new Range {Start = new Position {Line = 2}, End = new Position {Line = 11},},
                new Range {Start = new Position {Line = 12}, End = new Position {Line = 12},},
                new Range {Start = new Position {Line = 13}, End = new Position {Line = 13},},
                new Range {Start = new Position {Line = 14}, End = new Position {Line = 16},}
            };

            var results = positions.ToVisibleRanges();
            Assert.AreEqual(4, results.Count);
            Assert.AreEqual(0, results[0].Start.Line);
            Assert.AreEqual(1, results[0].End.Line);

            Assert.AreEqual(2, results[1].Start.Line);
            Assert.AreEqual(11, results[1].End.Line);

            Assert.AreEqual(12, results[2].Start.Line);
            Assert.AreEqual(13, results[2].End.Line);

            Assert.AreEqual(14, results[3].Start.Line);
            Assert.AreEqual(16, results[3].End.Line);
        }

        [TestMethod]
        public void RangeCollapsedTest1()
        {
            var positions = new List<Range>
            {
                new Range {Start = new Position {Line = 0}, End = new Position {Line =100},},
            };

            var results = positions.ToVisibleRanges();

            Assert.AreEqual(1, results.Count);
            Assert.AreEqual(0, results[0].Start.Line);
            Assert.AreEqual(100, results[0].End.Line);
        }

        [TestMethod]
        public void RangeCollapsedTest2()
        {
            var positions = new List<Range>
            {
                new Range {Start = new Position {Line = 0}, End = new Position {Line = 100}},
                new Range {Start = new Position {Line = 101}, End = new Position {Line = 101}},
                new Range {Start = new Position {Line = 102}, End = new Position {Line = 102}},
                new Range {Start = new Position {Line = 103}, End = new Position {Line = 103}},
            };

            var results = positions.ToVisibleRanges();

            Assert.AreEqual(2, results.Count);
            Assert.AreEqual(0, results[0].Start.Line);
            Assert.AreEqual(100, results[0].End.Line);

            Assert.AreEqual(101, results[1].Start.Line);
            Assert.AreEqual(103, results[1].End.Line);
        }

        [TestMethod]
        public void RangeCollapsedTest3()
        {
            var positions = new List<Range>
            {
                new Range {Start = new Position {Line = 0}, End = new Position {Line = 0}},
                new Range {Start = new Position {Line = 1}, End = new Position {Line = 1}},
                new Range {Start = new Position {Line = 2}, End = new Position {Line = 2}},
                new Range {Start = new Position {Line = 3}, End = new Position {Line = 3}},
            };

            var results = positions.ToVisibleRanges();

            Assert.AreEqual(1, results.Count);
            Assert.AreEqual(0, results[0].Start.Line);
            Assert.AreEqual(3, results[0].End.Line);
        }
    }
}