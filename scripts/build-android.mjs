import {spawnSync} from 'node:child_process';
import process from 'node:process';

const result=spawnSync(process.execPath,['node_modules/next/dist/bin/next','build'],{
  env:{...process.env,CAPACITOR_BUILD:'1'},
  stdio:'inherit',
});

if(result.error)throw result.error;
process.exitCode=result.status??1;
