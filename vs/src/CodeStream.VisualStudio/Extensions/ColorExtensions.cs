using System;
using System.Drawing;

namespace CodeStream.VisualStudio.Extensions
{
	public static class ColorExtensions
	{
		public static System.Windows.Media.Color ConvertToMediaColor(this System.Drawing.Color color)
		{
			return System.Windows.Media.Color.FromArgb(color.A, color.R, color.G, color.B);
		}

		public static string ToRgba(this Color color)
		{
			return $"rgba({color.R}, {color.G}, {color.B}, {(double)color.A / 255})";
		}

		public static float Lerp(this float start, float end, float amount)
		{
			float difference = end - start;
			float adjusted = difference * amount;
			return start + adjusted;
		}

		/// <summary>
		/// https://stackoverflow.com/questions/97646/how-do-i-determine-darker-or-lighter-color-variant-of-a-given-color/2690026#2690026
		/// </summary>
		/// <param name="color"></param>
		/// <param name="to"></param>
		/// <param name="amount"></param>
		/// <returns></returns>
		public static Color Lerp(this Color color, Color to, float amount)
		{
			// start colours as lerp-able floats
			float sr = color.R, sg = color.G, sb = color.B;

			// end colours as lerp-able floats
			float er = to.R, eg = to.G, eb = to.B;

			// lerp the colours to get the difference
			byte r = (byte)sr.Lerp(er, amount),
					g = (byte)sg.Lerp(eg, amount),
					b = (byte)sb.Lerp(eb, amount);

			// return the new colour
			return Color.FromArgb(r, g, b);
		}

		/// <summary>
		/// Darken a color
		/// </summary>
		/// <param name="color"></param>
		/// <param name="rate">0.1f == 10%</param>
		/// <param name="darker"></param>
		/// <returns></returns>
		public static Color Darken(this Color color, float rate = 0.1f, Color? darker = null)
		{
			return color.Lerp(darker ?? Color.Black, rate);
		}

		/// <summary>
		/// Lighten a color
		/// </summary>
		/// <param name="color"></param>
		/// <param name="rate">0.1f == 10%</param>
		/// <param name="lighter"></param>
		/// <returns></returns>
		public static Color Lighten(this Color color, float rate = 0.1f, Color? lighter = null)
		{
			return color.Lerp(lighter ?? Color.White, rate);
		}

		public static Color Opacity(this Color color, double percentage = 100)
		{
			return Color.FromArgb(Convert.ToInt32(255 * (color.A / 255 * percentage / 100)), color);
		}

		/// <summary>
		/// Returns whether a color is closer to black rather than white
		/// </summary>
		/// <param name="c2"></param>
		/// <remarks>https://stackoverflow.com/a/9780689/208022</remarks>
		/// <returns></returns>
		public static bool IsDark(this Color c2)
		{
			return (0.2126 * c2.R + 0.7152 * c2.G + 0.0722 * c2.B) < 128;
		}
	}
}
