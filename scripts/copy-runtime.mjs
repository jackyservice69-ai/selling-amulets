import { cp,mkdir } from 'node:fs/promises';
await mkdir('dist-server/.generated',{recursive:true});
await cp('.generated/postgres','dist-server/.generated/postgres',{recursive:true});
