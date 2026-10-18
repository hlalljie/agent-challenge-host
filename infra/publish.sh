#!/bin/zsh
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"

pnpm exec open-next build

# pnpm leaves Next's dependencies as symlinks beside the package. Zipping
# follows the Next symlink and drops those siblings, so copy them to the top.
node --input-type=module <<'EOF'
import { cpSync, lstatSync, mkdirSync, readdirSync, realpathSync, rmSync } from "node:fs";
import path from "node:path";

const root = ".open-next/server-functions/default/node_modules";
const pnpm = path.join(root, ".pnpm");
const nextDir = readdirSync(pnpm).find((name) => name.startsWith("next@"));

function copyPackage(src, dest) {
  if (lstatSync(dest, { throwIfNoEntry: false })?.isSymbolicLink()) rmSync(dest);
  if (lstatSync(dest, { throwIfNoEntry: false })?.isDirectory()) return;
  mkdirSync(path.dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true, dereference: true });
}

function copyNeighbors(dir) {
  for (const child of readdirSync(dir)) {
    if (child === ".bin" || child.startsWith(".")) continue;
    const childPath = path.join(dir, child);
    if (child.startsWith("@")) {
      for (const scoped of readdirSync(childPath)) {
        copyPackage(realpathSync(path.join(childPath, scoped)), path.join(root, child, scoped));
      }
      continue;
    }
    copyPackage(realpathSync(childPath), path.join(root, child));
  }
}

copyNeighbors(path.join(pnpm, nextDir, "node_modules"));
for (const entry of readdirSync(pnpm)) {
  const dir = path.join(pnpm, entry, "node_modules");
  try {
    if (lstatSync(dir).isDirectory()) copyNeighbors(dir);
  } catch {
    // Not every store entry has a node_modules folder.
  }
}
EOF

mkdir -p infra/.build
rm -f infra/.build/server.zip infra/.build/image.zip infra/.build/revalidate.zip
(cd .open-next/server-functions/default && zip -qr "$root/infra/.build/server.zip" .)
(cd .open-next/image-optimization-function && zip -qr "$root/infra/.build/image.zip" .)
(cd .open-next/revalidation-function && zip -qr "$root/infra/.build/revalidate.zip" .)

terraform -chdir=infra init -input=false
terraform -chdir=infra apply -input=false -auto-approve

bucket=$(terraform -chdir=infra output -raw bucket_name)
table=$(terraform -chdir=infra output -raw table_name)

aws s3 sync .open-next/assets "s3://$bucket/_assets" --exclude "_next/*" --cache-control "public,max-age=0,s-maxage=31536000,must-revalidate"
aws s3 sync .open-next/assets/_next "s3://$bucket/_assets/_next" --delete --cache-control "public,max-age=31536000,immutable"
aws s3 sync .open-next/cache "s3://$bucket/_cache" --delete

TABLE_NAME="$table" node --input-type=module <<'EOF'
import { readFileSync, writeFileSync } from "node:fs";

const table = process.env.TABLE_NAME;
const items = JSON.parse(readFileSync(".open-next/dynamodb-provider/dynamodb-cache.json", "utf8"));
writeFileSync(
  "infra/.build/dynamo.json",
  JSON.stringify({
    [table]: items.map((Item) => ({ PutRequest: { Item } })),
  }),
);
EOF
aws dynamodb batch-write-item --request-items file://infra/.build/dynamo.json

terraform -chdir=infra output -raw site_url
echo
