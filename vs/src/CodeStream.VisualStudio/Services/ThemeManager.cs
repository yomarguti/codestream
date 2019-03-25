using CodeStream.VisualStudio.Core.Logging;
using CodeStream.VisualStudio.Extensions;
using CodeStream.VisualStudio.Models;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;
using Microsoft.VisualStudio.Text.Editor;
using Serilog;
using System;
using System.Collections.Generic;
using System.Drawing;
using EnvironmentColors = Microsoft.VisualStudio.PlatformUI.EnvironmentColors;
using FontFamily = System.Windows.Media.FontFamily;
// ReSharper disable RedundantArgumentDefaultValue

namespace CodeStream.VisualStudio.Services
{
    public class ThemeResourceMetadata
    {
        /// <summary>
        /// Key that will be mapped to a CSS property name
        /// </summary>
        public string Key { get; set; }
        /// <summary>
        /// Name of the style property as it exists in Visual Studio UI
        /// </summary>
        public ThemeResourceKey ThemeResourceKey { get; set; }
        /// <summary>
        /// Optional function to alter the color
        /// </summary>
        public Func<System.Drawing.Color, string> Modifier { get; set; }
        /// <summary>
        /// Optional value, if set, will override the ThemeResourceKey and/or Modifier
        /// </summary>
        public string Value { get; set; }
    }

    public class ThemeInfo
    {
        public List<ThemeResourceMetadata> ThemeResourceItems { get; set; }
        public bool BackgroundColorIsDark { get; set; }        
    }

    public class ThemeManagerDummy { }

    public static class ThemeManager
    {
        private static readonly ILogger Log = LogManager.ForContext<ThemeManagerDummy>();

        private static readonly ThemeResourceKey BackgroundThemeResourceKey = EnvironmentColors.ToolWindowBackgroundColorKey;
        private static int DefaultFontSize = 12;

        public static System.Drawing.Color GetThemedColor(IVsUIShell5 shell, ThemeResourceKey themeResourceKey)
        {
            return VsColors.GetThemedGDIColor(shell, themeResourceKey);
        }

        public static ThemeInfo Generate()
        {
            try
            {                
                var shell = Package.GetGlobalService(typeof(SVsUIShell)) as IVsUIShell5;                

                // assume this theme is 'dark' if the ToolWindow background is dark
                var backgroundColor = GetThemedColor(shell, BackgroundThemeResourceKey);
                var textColor = GetThemedColor(shell, EnvironmentColors.ToolWindowTextColorKey);

                var colorInfos = new List<ThemeResourceMetadata>
                {
                    new ThemeResourceMetadata { Key = "app-background-color", ThemeResourceKey = BackgroundThemeResourceKey },
                    new ThemeResourceMetadata { Key = "background-color",                       ThemeResourceKey = BackgroundThemeResourceKey},
                    new ThemeResourceMetadata { Key = "vscode-button-hoverBackground",          ThemeResourceKey = EnvironmentColors.ToolWindowButtonDownBorderColorKey},
                    new ThemeResourceMetadata { Key = "vscode-sideBarSectionHeader-background", ThemeResourceKey = EnvironmentColors.ToolWindowContentGridColorKey},
                    new ThemeResourceMetadata { Key = "scrollbar-color",                        ThemeResourceKey = EnvironmentColors.SystemScrollBarColorKey},
                    new ThemeResourceMetadata { Key = "scrollbar-color-hover",                  ThemeResourceKey = EnvironmentColors.ScrollBarThumbMouseOverBackgroundColorKey }
                };

                var backgroundColorIsDark = backgroundColor.IsDark();

                if (Log.IsEnabled(Serilog.Events.LogEventLevel.Debug))
                {
                    Log.Debug($"BackgroundColor=({backgroundColor.ToHex()}), IsDark={backgroundColorIsDark}");
                    Log.Debug($"TextColor=({textColor.ToHex()}), IsDark={backgroundColorIsDark}");
                }

                if (backgroundColorIsDark)
                {
                    Log.Verbose($"BackgroundColorIsDark={backgroundColorIsDark}");

                    colorInfos.Add(new ThemeResourceMetadata { Key = "app-background-color-darker", ThemeResourceKey = BackgroundThemeResourceKey, Modifier = (b) => b.Darken(0.04f).ToHex() });
                    colorInfos.Add(new ThemeResourceMetadata { Key = "app-background-color-hover", ThemeResourceKey = BackgroundThemeResourceKey, Modifier = (b) => b.Lighten(0.03f).ToHex() });
                    colorInfos.Add(new ThemeResourceMetadata { Key = "app-background-image-color", Value = "#ffffff" });

                    colorInfos.Add(new ThemeResourceMetadata { Key = "base-background-color", ThemeResourceKey = BackgroundThemeResourceKey, Modifier = (b) => b.Lighten(0.04f).ToHex() });
                    colorInfos.Add(new ThemeResourceMetadata { Key = "base-border-color", ThemeResourceKey = EnvironmentColors.ToolWindowBorderColorKey, Modifier = (b) => b.Lighten(0.08f).ToHex() });

                    if (textColor.IsDark())
                    {
                        // in this case, there's a dark on dark issue -- default texts to something reasonable
                        colorInfos.Add(new ThemeResourceMetadata { Key = "color", Value = "#F1F1F1" });
                        colorInfos.Add(new ThemeResourceMetadata { Key = "text-color", Value = "#e4e3e3" });
                        colorInfos.Add(new ThemeResourceMetadata { Key = "text-color-subtle", Value = "rgba(241, 241, 241, 0.7)" });
                        colorInfos.Add(new ThemeResourceMetadata { Key = "text-color-subtle-extra", Value = "rgba(248, 248, 248, 0.6)" });
                        colorInfos.Add(new ThemeResourceMetadata { Key = "vscode-sideBarSectionHeader-foreground", Value = "#F1F1F1" });

                        if (Log.IsEnabled(Serilog.Events.LogEventLevel.Debug))
                        {
                            Log.Debug($"Dark on Dark, TextColor={textColor},{textColor.ToHex()} BackgroundColor={backgroundColor}, {backgroundColor.ToHex()}");
                        }
                    }
                    else
                    {
                        colorInfos.Add(new ThemeResourceMetadata { Key = "color", ThemeResourceKey = EnvironmentColors.ToolWindowTextColorKey });
                        colorInfos.Add(new ThemeResourceMetadata { Key = "text-color", ThemeResourceKey = EnvironmentColors.ToolWindowTextColorKey, Modifier = (b) => b.ToArgb(80) });
                        colorInfos.Add(new ThemeResourceMetadata { Key = "text-color-subtle", ThemeResourceKey = EnvironmentColors.ToolWindowTextColorKey, Modifier = (b) => b.ToArgb(70) });
                        colorInfos.Add(new ThemeResourceMetadata { Key = "text-color-subtle-extra", ThemeResourceKey = EnvironmentColors.ToolWindowTextColorKey, Modifier = (b) => b.Lighten(0.5f).ToArgb(60) });
                        colorInfos.Add(new ThemeResourceMetadata { Key = "vscode-sideBarSectionHeader-foreground", ThemeResourceKey = EnvironmentColors.ToolWindowTextColorKey });
                    }


                    colorInfos.Add(new ThemeResourceMetadata { Key = "link-color", ThemeResourceKey = EnvironmentColors.StartPageTextControlLinkSelectedColorKey });
                    colorInfos.Add(new ThemeResourceMetadata { Key = "text-color-info", ThemeResourceKey = EnvironmentColors.StartPageTextControlLinkSelectedColorKey });
                    colorInfos.Add(new ThemeResourceMetadata { Key = "text-color-info-muted", ThemeResourceKey = EnvironmentColors.ToolWindowButtonDownBorderColorKey, Modifier = (b) => b.Darken(0.1f).ToHex() });
                    colorInfos.Add(new ThemeResourceMetadata { Key = "tool-panel-background-color", ThemeResourceKey = BackgroundThemeResourceKey, Modifier = (b) => b.Lighten(0.1f).ToHex() });
                    colorInfos.Add(new ThemeResourceMetadata { Key = "vscode-button-background", ThemeResourceKey = EnvironmentColors.ToolWindowButtonDownColorKey });
                }
                else
                {
                    // for the light themes -- VS uses a harder-to-read background on the active ToolWindow, 
                    // that makes for a harder-to-read link/button. So for lighter themes, we se the ToolWindowButtonInactiveColorKey instead

                    colorInfos.Add(new ThemeResourceMetadata { Key = "app-background-color-darker", ThemeResourceKey = BackgroundThemeResourceKey });
                    colorInfos.Add(new ThemeResourceMetadata { Key = "app-background-color-hover", ThemeResourceKey = BackgroundThemeResourceKey, Modifier = (b) => b.Darken(0.15f).ToHex() });
                    colorInfos.Add(new ThemeResourceMetadata { Key = "app-background-image-color", Value = "#000000" });
                    colorInfos.Add(new ThemeResourceMetadata { Key = "base-background-color", ThemeResourceKey = BackgroundThemeResourceKey, Modifier = (b) => b.Darken(0.1f).ToHex() });
                    colorInfos.Add(new ThemeResourceMetadata { Key = "base-border-color", ThemeResourceKey = EnvironmentColors.ToolWindowBorderColorKey, Modifier = (b) => b.Darken(0.1f).ToHex() });

                    if (textColor.IsDark())
                    {
                        colorInfos.Add(new ThemeResourceMetadata { Key = "color", ThemeResourceKey = EnvironmentColors.ToolWindowTextColorKey });
                        colorInfos.Add(new ThemeResourceMetadata { Key = "text-color", ThemeResourceKey = EnvironmentColors.ToolWindowTextColorKey, Modifier = (b) => b.ToArgb(90) });
                        colorInfos.Add(new ThemeResourceMetadata { Key = "text-color-subtle", ThemeResourceKey = EnvironmentColors.ToolWindowTextColorKey, Modifier = (b) => b.ToArgb(70) });
                        colorInfos.Add(new ThemeResourceMetadata { Key = "text-color-subtle-extra", ThemeResourceKey = EnvironmentColors.ToolWindowTextColorKey, Modifier = (b) => b.Darken(0.5f).ToArgb(60) });
                        colorInfos.Add(new ThemeResourceMetadata { Key = "vscode-sideBarSectionHeader-foreground", ThemeResourceKey = EnvironmentColors.ToolWindowTextColorKey });
                    }
                    else
                    {
                        // in this case, there's a light on light issue -- default texts to something reasonable
                        colorInfos.Add(new ThemeResourceMetadata { Key = "color", Value = "#000000" });
                        colorInfos.Add(new ThemeResourceMetadata { Key = "text-color", Value = "#111111" });
                        colorInfos.Add(new ThemeResourceMetadata { Key = "text-color-subtle", Value = "#333333" });
                        colorInfos.Add(new ThemeResourceMetadata { Key = "text-color-subtle-extra", Value = "#666666" });
                        colorInfos.Add(new ThemeResourceMetadata { Key = "vscode-sideBarSectionHeader-foreground", Value = "#000000" });
                        if (Log.IsEnabled(Serilog.Events.LogEventLevel.Debug))
                        {
                            Log.Debug($"Light on Light, TextColor={textColor},{textColor.ToHex()} BackgroundColor={backgroundColor}, {backgroundColor.ToHex()}");
                        }
                    }

                    colorInfos.Add(new ThemeResourceMetadata { Key = "link-color", ThemeResourceKey = EnvironmentColors.ToolWindowButtonInactiveColorKey });
                    colorInfos.Add(new ThemeResourceMetadata { Key = "text-color-info", ThemeResourceKey = EnvironmentColors.StartPageTextControlLinkSelectedColorKey });
                    colorInfos.Add(new ThemeResourceMetadata { Key = "text-color-info-muted", ThemeResourceKey = EnvironmentColors.ToolWindowButtonDownBorderColorKey });
                    colorInfos.Add(new ThemeResourceMetadata { Key = "tool-panel-background-color", ThemeResourceKey = BackgroundThemeResourceKey, Modifier = (b) => b.Darken(0.1f).ToHex() });
                    colorInfos.Add(new ThemeResourceMetadata { Key = "vscode-button-background", ThemeResourceKey = EnvironmentColors.ToolWindowButtonInactiveColorKey });
                }

                if (Log.IsEnabled(Serilog.Events.LogEventLevel.Debug))
                {
                    Log.Debug($"TextColor={textColor.ToHex()}, BackgroundColor={backgroundColor.ToHex()} BackgroundColorIsDark={backgroundColorIsDark}");
                }

                var fontFamilyString = "Arial, Consolas, sans-serif";
                var fontFamily = System.Windows.Application.Current.FindResource(VsFonts.EnvironmentFontFamilyKey) as FontFamily;
                if (fontFamily != null)
                {
                    fontFamilyString = fontFamily.ToString();
                    if (fontFamilyString.Contains(" "))
                    {
                        fontFamilyString = $"\"{fontFamilyString}\"";
                    }
                }

                colorInfos.Add(new ThemeResourceMetadata { Key = "vscode-editor-font-family", Value = fontFamilyString });
                colorInfos.Add(new ThemeResourceMetadata { Key = "font-family", Value = fontFamilyString });

                var metrics = CreateEditorMetrics(null);
                var fontSize = metrics == null ?
                    DefaultFontSize.ToString() :
                    metrics.FontSize.ToIntSafe(DefaultFontSize).ToString();

                colorInfos.Add(new ThemeResourceMetadata { Key = "font-size", Value = fontSize });

                return new ThemeInfo
                {
                    ThemeResourceItems = colorInfos,
                    BackgroundColorIsDark = backgroundColorIsDark
                };
            }
            catch(Exception ex)
            {
                Log.Error(ex, nameof(Generate));

                return new ThemeInfo();
            }
        }

        public static EditorMetrics CreateEditorMetrics(IWpfTextView textView)
        {
            return new EditorMetrics
            {
                LineHeight = textView?.LineHeight.ToInt(),
                FontSize = System.Windows.Application.Current.FindResource(VsFonts.EnvironmentFontSizeKey).ToIntSafe(DefaultFontSize),
                EditorMargins = new EditorMargins
                {
                    //TODO figure out the real value here...
                    Top = 21
                }
            };
        }

        /// <summary>
        /// The default color is blue-ish
        /// </summary>
        private static Color DefaultColor = Color.FromArgb(0, 110, 183);

        public static System.Drawing.Color GetCodemarkColorSafe(string colorName)
        {
            if (colorName.IsNullOrWhiteSpace()) return DefaultColor;

            if (ColorMap.TryGetValue(colorName, out Color value))
            {
                return value;
            }

            return DefaultColor;
        }

        public static Dictionary<string, System.Drawing.Color> ColorMap = new Dictionary<string, System.Drawing.Color>
        {
            { "blue", DefaultColor},
            { "green", Color.FromArgb(88, 181, 71)},
            { "yellow", Color.FromArgb(240, 208, 5)},
            { "orange", Color.FromArgb(255, 147, 25)},
            { "red",  Color.FromArgb(232, 78, 62)},
            { "purple", Color.FromArgb(187, 108, 220)},
            { "aqua", Color.FromArgb(0, 186, 220)},
            { "gray", Color.FromArgb(127, 127, 127)}
        };

        /*
            /// <summary>
            /// this is some helper code to generate a theme color palette from the current VS theme
            /// </summary>
            /// <returns></returns>
            private static string GenerateVisualStudioColorTheme()
            {
                var d = new System.Collections.Generic.Dictionary<string, string>();
                Type type = typeof(EnvironmentColors); // MyClass is static class with static properties
                foreach (var p in type.GetProperties().Where(_ => _.Name.StartsWith("ToolWindow")))
                {
                    var val = typeof(EnvironmentColors).GetProperty(p.Name, BindingFlags.Public | BindingFlags.Static);
                    var v = val.GetValue(null);
                    var trk = v as ThemeResourceKey;
                    if (trk != null)
                    {
                        var color = VSColorTheme.GetThemedColor(trk);
                        d.Add(p.Name, color.ToHex());
                    }

                    // d.Add(p.Name, ((System.Drawing.Color)val).ToHex());
                }

                string s = "";
                foreach (var kvp in d)
                {
                    s += $@"<div>";
                    s += $@"<span style='display:inline-block; height:50ps; width: 50px; background:{kvp.Value}; padding-right:5px; margin-right:5px;'>&nbsp;</span>";
                    s += $@"<span>{kvp.Value} - {kvp.Key}</span>";
                    s += "</div>";
                }

                return null;
            }
        */
    }

}