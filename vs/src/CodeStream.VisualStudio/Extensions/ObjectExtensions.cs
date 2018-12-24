namespace CodeStream.VisualStudio.Extensions
{
    public static class ObjectExtensions
    {
        public static int ToInt(this object o) => o == null ? 0 : int.Parse(o.ToString());        
    }
}
