using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace CodeStream.VisualStudio.Attributes
{
    /// <summary>
    /// Signifies the class is injected via VisualStudio's service provider, do not instantiate it manually
    /// </summary>
    public class InjectedAttribute : Attribute
    {
    }
}
