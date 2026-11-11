// Prints "<path>: <error>" for every file that is not valid JSON.
// Runs with Node (`node validar-json.js <files>`) or with macOS JavaScript for Automation
// (`osascript -l JavaScript validar-json.js <files>`), which every Mac has.

function check(path, text) {
  try {
    JSON.parse(text);
    return null;
  } catch (e) {
    return path + ": " + e.message;
  }
}

if (typeof process !== "undefined" && process.versions && process.versions.node) {
  const fs = require("fs");
  const errors = process.argv
    .slice(2)
    .map((p) => check(p, fs.readFileSync(p, "utf8")))
    .filter(Boolean);
  if (errors.length) process.stdout.write(errors.join("\n") + "\n");
}

// osascript calls run() with the arguments.
function run(argv) {
  ObjC.import("Foundation");
  const errors = [];
  for (const p of argv) {
    const text = $.NSString.stringWithContentsOfFileEncodingError(p, $.NSUTF8StringEncoding, null);
    const error = check(p, ObjC.unwrap(text) || "");
    if (error) errors.push(error);
  }
  return errors.join("\n");
}
