const { convert } = require("convert-svg-to-png");
const data = require("../Stream/icons8-data.json");
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
	.help()
	.alias("help", "h").argv;

const convertAll = async () => {
	Object.keys(data).map(async key => {
		const icon = data[key];
		const svg =
			'<svg width="' +
			argv.size +
			'" height="' +
			argv.size +
			'" fill="' +
			argv.color +
			'" viewBox="' +
			icon.viewBox +
			'">' +
			icon.path +
			'"</svg>';
		const png = await convert(svg, {});
		fs.writeFile("/tmp/" + key + ".png", png, function(err) {
			if (err) {
				return console.log(err);
			}
			console.log("The file /tmp/" + key + ".png was saved!");
		});
	});
};

convertAll();
// (async () => {
// 	const inputFilePath = "/path/to/my-image.svg";
// 	const outputFilePath = await convertFile(inputFilePath);

// 	console.log(outputFilePath);
// 	//=> "/path/to/my-image.png"
// })();
