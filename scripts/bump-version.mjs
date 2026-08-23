import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const versionJsonPath = path.join(rootDir, "version.json");
const packageJsonPath = path.join(rootDir, "package.json");
const releaseNotesPath = path.join(rootDir, "RELEASE_NOTES.md");

const type = process.argv[2] || "patch";

if (!fs.existsSync(versionJsonPath)) {
  fs.writeFileSync(
    versionJsonPath,
    JSON.stringify(
      { major: 1, minor: 0, patch: 0, versionName: "1.0.0", versionCode: 1 },
      null,
      2
    )
  );
}

const current = JSON.parse(fs.readFileSync(versionJsonPath, "utf-8"));
let major = current.major ?? 1;
let minor = current.minor ?? 0;
let patch = current.patch ?? 0;
let versionCode = (current.versionCode ?? 1) + 1;

if (type === "major") {
  major += 1;
  minor = 0;
  patch = 0;
} else if (type === "minor") {
  minor += 1;
  patch = 0;
} else if (type === "patch") {
  patch += 1;
} else if (/^\d+\.\d+\.\d+$/.test(type)) {
  const parts = type.split(".").map(Number);
  major = parts[0];
  minor = parts[1];
  patch = parts[2];
} else {
  console.error(`❌ Invalid bump type: "${type}". Use "patch", "minor", "major", or a specific SemVer (e.g. "1.2.0").`);
  process.exit(1);
}

const versionName = `${major}.${minor}.${patch}`;

const newVersionData = {
  major,
  minor,
  patch,
  versionName,
  versionCode,
};

// 1. Write version.json
fs.writeFileSync(versionJsonPath, JSON.stringify(newVersionData, null, 2) + "\n");

// 2. Update package.json
if (fs.existsSync(packageJsonPath)) {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  pkg.version = versionName;
  fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + "\n");
}

// 3. Update header in RELEASE_NOTES.md if present
if (fs.existsSync(releaseNotesPath)) {
  let notes = fs.readFileSync(releaseNotesPath, "utf-8");
  if (notes.includes("### 🚀 What's New")) {
    notes = notes.replace(
      /### 🚀 What's New( in v[^\n]+)?/,
      `### 🚀 What's New in v${versionName}`
    );
    fs.writeFileSync(releaseNotesPath, notes);
  }
}

console.log("\n==========================================");
console.log(`🚀 FitTracker Version Bumped Successfully!`);
console.log(`   Version Name: v${versionName}`);
console.log(`   Version Code: ${versionCode}`);
console.log("==========================================");
console.log("Updated files:");
console.log(" • version.json");
console.log(" • package.json");
console.log(" • RELEASE_NOTES.md");
console.log("\nNext steps:");
console.log(` 1. Edit RELEASE_NOTES.md with your latest changes`);
console.log(` 2. Run: git add . && git commit -m "chore(release): bump version to v${versionName}"`);
console.log(` 3. Run: git push origin main\n`);
