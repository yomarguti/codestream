using System;

namespace CodeStream.VisualStudio.Attributes
{
    /// <summary>
    /// Signifies the class is injected via VisualStudio's service provider, do not instantiate it manually. 
    /// This is just a marker!
    /// </summary>
    public class InjectedAttribute : Attribute
    {
    }
}
