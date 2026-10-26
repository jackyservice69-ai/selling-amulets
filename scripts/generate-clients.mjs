import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const source=await readFile('prisma/schema.prisma','utf8');
const postgres=source.replace('provider = "prisma-client-js"','provider = "prisma-client-js"\n  output = "../../.generated/postgres"\n  binaryTargets = ["native", "debian-openssl-3.0.x"]').replace('provider = "mysql"','provider = "postgresql"').replace('url      = env("DATABASE_URL")','url      = env("DATABASE_URL")\n  directUrl = env("DIRECT_DATABASE_URL")');
await mkdir('prisma/production',{recursive:true});
await writeFile('prisma/production/schema.prisma',postgres);
for(const schema of ['prisma/schema.prisma','prisma/production/schema.prisma']){
 const env={...process.env};if(schema.includes('production')){if(!env.DATABASE_URL?.startsWith('postgres'))env.DATABASE_URL='postgresql://build:build@localhost:5432/build';env.DIRECT_DATABASE_URL ||= env.DATABASE_URL;}
 const r=spawnSync(process.execPath,['node_modules/prisma/build/index.js','generate','--schema',schema],{env,stdio:'inherit',windowsHide:true});if(r.status)process.exit(r.status);
}
