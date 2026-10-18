#!/usr/bin/env node
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const files=(await readdir('scripts')).filter((name)=>name.endsWith('.mjs'));
for(const name of files){
  if(name==='finalize-nexa-1.95-release-guards.mjs'||name==='test-data-api-remediation-readiness.mjs') continue;
  const file=path.join('scripts',name);
  let source=await readFile(file,'utf8');
  const before=source;
  source=source.replaceAll("'nexa-1-94'","'nexa-1-95'");
  source=source.split('\n').map((line)=>{
    if((line.includes('pkg.version')||line.includes('packageJson.version'))&&line.includes('1.94.0')){
      return line.replaceAll('1.94.0','1.95.0');
    }
    if(line.includes("NEXA_VERSION = '1\\.94\\.0'")){
      return line.replace("1\\.94\\.0","1\\.95\\.0");
    }
    if(line.includes("nexa-1\\.94\\.0-verified")){
      return line.replace("nexa-1\\.94\\.0-verified","nexa-1\\.95\\.0-verified");
    }
    if(line.includes("nexa-1\\.94\\.0-verification-evidence")){
      return line.replace("nexa-1\\.94\\.0-verification-evidence","nexa-1\\.95\\.0-verification-evidence");
    }
    return line;
  }).join('\n');
  if(source!==before) await writeFile(file,source);
}
