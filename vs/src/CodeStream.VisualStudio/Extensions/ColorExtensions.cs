using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace CodeStream.VisualStudio.Extensions
{
    public static class ColorExtensions
    {
        public static string ToHex(this Color color)
        {
            return "#"+ color.R.ToString("X2") + color.G.ToString("X2") + color.B.ToString("X2");
        }

        public static float Lerp(this float start, float end, float amount)
        {
            float difference = end - start;
            float adjusted = difference * amount;
            return start + adjusted;
        }
		
        public static Color Lerp(this Color colour, Color to, float amount)
        {
            // start colours as lerp-able floats
            float sr = colour.R, sg = colour.G, sb = colour.B;

            // end colours as lerp-able floats
            float er = to.R, eg = to.G, eb = to.B;

            // lerp the colours to get the difference
            byte r = (byte)sr.Lerp(er, amount),
                 g = (byte)sg.Lerp(eg, amount),
                 b = (byte)sb.Lerp(eb, amount);

            // return the new colour
            return Color.FromArgb(r, g, b);
        }

        public static Color Darken(this Color color, float rate = 0.1f, Color? darker = null)
        {
            return color.Lerp(darker ?? Color.Black, rate);
        }

        public static Color Lighten(this Color color, float rate = 0.1f, Color? lighter = null)
        {
            return color.Lerp(lighter ?? Color.White, rate);
        }
    }
}
