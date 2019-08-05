namespace CodeStream.VisualStudio.Core.Models {
	public class User {
		public User(string id, string userName, string emailAddress, string teamName, int teamCount) {
			Id = id;
			UserName = userName;
			EmailAddress = emailAddress;
			TeamName = teamName;
			TeamCount = teamCount;
		}

		public string Id { get; }
		public string TeamName { get; }
		public string UserName { get; }
		public string EmailAddress { get; }
		public int TeamCount { get; set; }

		public bool HasSingleTeam() => TeamCount == 1;
	}
}
