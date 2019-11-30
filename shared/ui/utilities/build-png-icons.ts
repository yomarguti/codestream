const { convert } = require("convert-svg-to-png");
const icons8 = require("../Stream/icons8-data.json");
const octicons = require("@primer/octicons");
const fs = require("fs");
const yargs = require("yargs");

const argv = yargs
	.command("build-png-icons", "Converts CodeStream SVGs into PNG icons", {})
	.option("size", {
		alias: "s",
		description: "the size of the pngs in puxels",
		type: "number",
		default: 32
	})
	.option("color", {
		alias: "c",
		description: "the color of the icons",
		type: "string",
		default: "black"
	})
	.option("output-directory", {
		alias: "o",
		description: "the color of the icons",
		type: "string",
		default: "/tmp/"
	})
	.help()
	.alias("help", "h").argv;

const dir = argv["output-directory"];
const convertIcon = async icon => {
	const viewBox = icon.viewBox || (icon.options ? icon.options.viewBox : "0 0 30 30");
	const svgTag = `<svg width="${argv.size}" height="${argv.size}" fill="${argv.color}" viewBox="${viewBox}">`;
	const svgString = svgTag + icon.path + "</svg>";
	const png = await convert(svgString, {});
	fs.writeFile(dir + icon.name + ".png", png, function(err) {
		if (err) return console.log(err);
		console.log("The file " + dir + icon.name + ".png was saved!");
	});
};

const convertIcons = async hash => {
	const array = Object.values(hash);
	for (let index = 0; index < array.length; index++) {
		await convertIcon(array[index]);
	}
};

convertIcons(icons8);
convertIcons(octicons);
