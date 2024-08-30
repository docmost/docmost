const fs = require("node:fs");
const path = require("node:path");

const localsPath = path.join(__dirname, "../public/locales");

const supportLanguages = ["en", "zh"];
const supportCommands = ["add-ns"];

function ensureLanguageDirectories() {
  if (!fs.existsSync(localsPath)) {
    fs.mkdirSync(localsPath, { recursive: true });
  }

  supportLanguages.forEach((lang) => {
    const langPath = path.join(localsPath, lang);

    if (!fs.existsSync(langPath)) {
      fs.mkdirSync(langPath);
    }
  });
}

function addNamespaces(namespaces) {
  supportLanguages.forEach((lang) => {
    const langPath = path.join(localsPath, lang);

    namespaces.forEach((ns) => {
      const nsFilePath = path.join(langPath, `${ns}.json`);

      if (!fs.existsSync(nsFilePath)) {
        fs.writeFileSync(nsFilePath, "{}", "utf8");
        console.log(`Created empty ${ns}.json file in ${lang} directory`);
      } else {
        console.log(
          `${ns}.json file already exists in ${lang} directory, skipping creation`,
        );
      }
    });
  });
}

ensureLanguageDirectories();

const [command, ...params] = process.argv.slice(2);

if (!supportCommands.includes(command)) {
  console.warn(
    `Only support the follow commands: ${supportCommands.join(" ")} `,
  );
  console.log();
}

switch (command) {
  case "add-ns":
    addNamespaces(params);
    break;
  default:
    console.warn("You should input a command");
}
