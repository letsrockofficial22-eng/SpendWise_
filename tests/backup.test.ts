import {describe,expect,it} from 'vitest';
import {createBackup,encryptBackup,mergeBackupData,parseBackup,parseBackupFile} from '../lib/backup';
import {defaultPreferences} from '../lib/mock-data';
import type {OfflineState} from '../lib/offline-storage';

const empty:OfflineState={userId:'user-a',transactions:[],budgets:[],loans:[],bills:[],sharedExpenses:[],preferences:defaultPreferences,pending:[]};

describe('portable backups',()=>{
  it('validates account identity and merges new records without replacing local records',()=>{
    const backup=createBackup({...empty,transactions:[{id:'b77bb64e-2524-4d8c-a7db-d79c26389534',type:'income',amount:15,category:'Gift',paymentMethod:'cash',date:'2026-11-01T00:00:00Z'}]});
    const imported=parseBackup(JSON.stringify(backup),'user-a');
    const current={...empty,transactions:[{id:'f20d6e5f-7c3d-4c33-9ef7-788d275c49cb',type:'expense' as const,amount:2,category:'Food',paymentMethod:'cash' as const,date:'2026-11-02T00:00:00Z'}]};
    const result=mergeBackupData(current,imported);
    expect(result.transactions.map(item=>item.id)).toEqual(['f20d6e5f-7c3d-4c33-9ef7-788d275c49cb','b77bb64e-2524-4d8c-a7db-d79c26389534']);
    expect(()=>parseBackup(JSON.stringify(backup),'user-b')).toThrow('different SpendWise account');
  });

  it('rejects malformed or unsupported backup data',()=>{
    expect(()=>parseBackup('{', 'user-a')).toThrow('valid JSON');
    expect(()=>parseBackup(JSON.stringify({format:'spendwise-backup',version:99,data:{}}),'user-a')).toThrow('supported');
  });

  it('encrypts backups and only decrypts them with the same passphrase',async()=>{
    const source=createBackup({...empty,transactions:[{id:'b77bb64e-2524-4d8c-a7db-d79c26389534',type:'income',amount:15,category:'Gift',paymentMethod:'cash',date:'2026-11-01T00:00:00Z'}]});
    const encrypted=await encryptBackup(source,'correct horse battery');
    const text=JSON.stringify(encrypted);
    expect(text).not.toContain('Gift');
    expect(await parseBackupFile(text,'user-a','correct horse battery')).toEqual(source.data);
    await expect(parseBackupFile(text,'user-a','incorrect horse battery')).rejects.toThrow('decrypt');
  });

  it('continues to import existing unencrypted backups',async()=>{
    const source=createBackup(empty);
    await expect(parseBackupFile(JSON.stringify(source),'user-a','')).resolves.toEqual(source.data);
  });
});
