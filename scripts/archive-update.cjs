const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const { version, build } = require(path.join(root, "package.json"));
const installerName = `${build.productName}-Setup-${version}-x64.exe`;
const installerPath = path.join(root, build.directories.output, installerName);
const updateDirectory = path.join(root, "UPDATE");

if (!fs.existsSync(installerPath)) {
  throw new Error(`Instalador da versão ${version} não encontrado: ${installerPath}`);
}

fs.mkdirSync(updateDirectory, { recursive: true });
fs.copyFileSync(installerPath, path.join(updateDirectory, installerName));
fs.writeFileSync(
  path.join(updateDirectory, "ULTIMA_VERSAO.txt"),
  `Versao mais recente: ${version}\nInstalador: ${installerName}\n`,
  "utf8"
);
console.log(`Instalador ${version} arquivado em UPDATE\\${installerName}`);
