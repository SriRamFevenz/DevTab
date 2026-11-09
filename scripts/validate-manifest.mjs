import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const errors = [];
const warnings = [];

const fail = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

function readJson(file) {
  try {
    return JSON.parse(readFileSync(join(root, file), "utf8"));
  } catch (err) {
    fail(`${file}: ${err.message}`);
    return null;
  }
}

function requireFile(file, label) {
  if (!existsSync(join(root, file))) fail(`${label}: missing file "${file}"`);
}

const manifest = readJson("manifest.json");

if (manifest) {
  if (manifest.manifest_version !== 3) fail("manifest.json: manifest_version must be 3");
  if (!manifest.name || typeof manifest.name !== "string") fail("manifest.json: name is required");
  if (!manifest.version) {
    fail("manifest.json: version is required");
  } else if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
    fail(`manifest.json: version "${manifest.version}" must be MAJOR.MINOR.PATCH`);
  }
  if (!manifest.description) {
    fail("manifest.json: description is required");
  } else if (manifest.description.length > 132) {
    fail(`manifest.json: description is ${manifest.description.length} characters (Chrome limit is 132)`);
  }

  const overrides = manifest.chrome_url_overrides ?? {};
  if (!overrides.newtab) fail("manifest.json: chrome_url_overrides.newtab is required");
  else requireFile(overrides.newtab, "chrome_url_overrides.newtab");

  if (!manifest.icons || Object.keys(manifest.icons).length === 0) {
    fail("manifest.json: icons are required");
  } else {
    for (const [size, file] of Object.entries(manifest.icons)) {
      if (!/^\d+$/.test(size)) warn(`manifest.json: icon key "${size}" is not a pixel size`);
      requireFile(file, `icons.${size}`);
    }
  }

  if (!Array.isArray(manifest.permissions)) {
    fail("manifest.json: permissions must be an array");
  } else {
    const known = new Set(["storage", "favicon", "topSites"]);
    for (const permission of manifest.permissions) {
      if (!known.has(permission)) warn(`manifest.json: unexpected permission "${permission}" (update README and SECURITY)`);
    }
  }

  const worker = manifest.background?.service_worker;
  if (worker) requireFile(worker, "background.service_worker");

  for (const script of manifest.content_scripts ?? []) {
    for (const file of script.js ?? []) requireFile(file, "content_scripts.js");
    for (const file of script.css ?? []) requireFile(file, "content_scripts.css");
  }

  for (const entry of manifest.web_accessible_resources ?? []) {
    for (const file of entry.resources ?? []) {
      if (!file.includes("*")) requireFile(file, "web_accessible_resources");
    }
  }

  const pkg = readJson("package.json");
  if (pkg && pkg.version && pkg.version !== manifest.version) {
    fail(`package.json version "${pkg.version}" does not match manifest version "${manifest.version}"`);
  }
  if (pkg && pkg.homepage && manifest.homepage_url && manifest.homepage_url !== pkg.homepage) {
    fail(`manifest homepage_url "${manifest.homepage_url}" does not match package.json homepage "${pkg.homepage}"`);
  }
}

for (const warning of warnings) console.warn(`warning: ${warning}`);

if (errors.length) {
  for (const error of errors) console.error(`error: ${error}`);
  console.error(`\nmanifest validation failed with ${errors.length} error(s)`);
  process.exit(1);
}

console.log(`manifest.json is valid (DevTab ${manifest.version})`);
