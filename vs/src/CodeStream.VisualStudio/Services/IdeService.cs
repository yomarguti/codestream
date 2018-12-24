using EnvDTE;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace CodeStream.VisualStudio.Services
{
    public class IdeService
    {
        //EnvDTE80.DTE2 _dte;
        //public IdeService(EnvDTE80.DTE2 dte)
        //{

        //}

        //public void adsf(FileInfo file)
        //{
        //    if (null == file)
        //        throw new ArgumentNullException(nameof(file));

        //    var dte2 = (EnvDTE80.DTE2)DTE;
        //    dte2.MainWindow.Activate();
        //    var newWindow = dte2.ItemOperations.IsFileOpen(file.FullName)
        //            ? FindWindow(file.FullName)
        //            : dte2.ItemOperations.OpenFile(file.FullName);
        //    newWindow.Activate();
        //}
    }
}
