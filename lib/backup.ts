import type {Budget,Loan,RecurringBill,SharedExpense,Transaction,UserPreferences} from '../types';
import type {OfflineState} from './offline-storage';
import {Capacitor} from '@capacitor/core';
import {Directory,Encoding,Filesystem} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';
import {isValidMoney} from './finance-utils';

export interface BackupData {
  userId:string;
  transactions:Transaction[];
  budgets:Budget[];
  loans:Loan[];
  bills:RecurringBill[];
  sharedExpenses:SharedExpense[];
  preferences:UserPreferences;
}

export interface BackupFile {format:'spendwise-backup';version:1;data:BackupData}
export interface EncryptedBackupFile {
  format:'spendwise-encrypted-backup';
  version:1;
  kdf:'PBKDF2-SHA-256';
  iterations:number;
  cipher:'AES-GCM';
  salt:string;
  iv:string;
  ciphertext:string;
}

const backupIterations=310000;
const encoder=new TextEncoder();
const decoder=new TextDecoder();
function toBase64(bytes:Uint8Array){
  let binary='';
  for(const byte of bytes)binary+=String.fromCharCode(byte);
  return btoa(binary);
}
function fromBase64(value:string){
  return Uint8Array.from(atob(value),character=>character.charCodeAt(0));
}
async function backupKey(passphrase:string,salt:Uint8Array){
  if(passphrase.trim().length<12)throw new Error('Use a backup passphrase with at least 12 characters.');
  const material=await crypto.subtle.importKey('raw',encoder.encode(passphrase),'PBKDF2',false,['deriveKey']);
  const saltBuffer=new Uint8Array(new ArrayBuffer(salt.length));
  saltBuffer.set(salt);
  return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt:saltBuffer,iterations:backupIterations},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}

export async function encryptBackup(backup:BackupFile,passphrase:string):Promise<EncryptedBackupFile>{
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await backupKey(passphrase,salt);
  const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,encoder.encode(JSON.stringify(backup)));
  return {format:'spendwise-encrypted-backup',version:1,kdf:'PBKDF2-SHA-256',iterations:backupIterations,cipher:'AES-GCM',salt:toBase64(salt),iv:toBase64(iv),ciphertext:toBase64(new Uint8Array(ciphertext))};
}

export async function parseBackupFile(text:string,userId:string,passphrase:string):Promise<BackupData>{
  let parsed:unknown;
  try{parsed=JSON.parse(text)}catch{throw new Error('This backup file is not valid JSON.')}
  if(isRecord(parsed)&&parsed.format==='spendwise-backup')return parseBackup(text,userId);
  if(!isRecord(parsed)||parsed.format!=='spendwise-encrypted-backup'||parsed.version!==1||parsed.kdf!=='PBKDF2-SHA-256'||parsed.cipher!=='AES-GCM'||parsed.iterations!==backupIterations||typeof parsed.salt!=='string'||typeof parsed.iv!=='string'||typeof parsed.ciphertext!=='string')throw new Error('This is not a supported encrypted SpendWise backup file.');
  try{
    const salt=fromBase64(parsed.salt);
    const iv=fromBase64(parsed.iv);
    if(salt.length!==16||iv.length!==12)throw new Error('Invalid encryption parameters.');
    const key=await backupKey(passphrase,salt);
    const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,fromBase64(parsed.ciphertext));
    return parseBackup(decoder.decode(plaintext),userId);
  }catch(error){
    if(error instanceof Error&&error.message.includes('at least 12 characters'))throw error;
    throw new Error('Could not decrypt this backup. Check the passphrase and try again.');
  }
}

export function createBackup(state:OfflineState):BackupFile{
  return {format:'spendwise-backup',version:1,data:{
    userId:state.userId,
    transactions:state.transactions,
    budgets:state.budgets,
    loans:state.loans||[],
    bills:state.bills||[],
    sharedExpenses:state.sharedExpenses||[],
    preferences:state.preferences,
  }};
}

function isRecord(value:unknown):value is Record<string,unknown>{
  return typeof value==='object'&&value!==null&&!Array.isArray(value);
}

const validId=(value:unknown)=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const validDate=(value:unknown)=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)&&Number.isFinite(Date.parse(value));
const isMoney=(value:unknown):value is number=>typeof value==='number'&&isValidMoney(value);
const isTransaction=(value:unknown):value is Transaction=>isRecord(value)&&validId(value.id)&&(value.type==='income'||value.type==='expense')&&isMoney(value.amount)&&typeof value.category==='string'&&value.category.length>0&&['cash','bkash','nagad','bank','other'].includes(String(value.paymentMethod))&&validDate(value.date)&&(value.loanId===undefined||validId(value.loanId));
const isBudget=(value:unknown):value is Budget=>isRecord(value)&&validId(value.id)&&typeof value.name==='string'&&value.name.trim().length>0&&isMoney(value.amount)&&(value.period==='daily'||value.period==='monthly');
const isLoan=(value:unknown):value is Loan=>isRecord(value)&&validId(value.id)&&(value.direction==='repay'||value.direction==='lent')&&typeof value.person==='string'&&value.person.trim().length>0&&isMoney(value.principal)&&typeof value.remaining==='number'&&Number.isFinite(value.remaining)&&value.remaining>=0&&value.remaining<=Number(value.principal)&&validDate(value.dueDate);
const isBill=(value:unknown):value is RecurringBill=>isRecord(value)&&validId(value.id)&&typeof value.name==='string'&&value.name.trim().length>0&&isMoney(value.amount)&&typeof value.category==='string'&&value.category.trim().length>0&&(value.frequency==='weekly'||value.frequency==='monthly'||value.frequency==='yearly')&&validDate(value.nextDue)&&typeof value.reminder==='boolean'&&(value.type===undefined||value.type==='income'||value.type==='expense');
const isSharedExpense=(value:unknown):value is SharedExpense=>isRecord(value)&&validId(value.id)&&typeof value.title==='string'&&value.title.trim().length>0&&isMoney(value.total)&&typeof value.paidBy==='string'&&validDate(value.createdAt)&&Array.isArray(value.shares)&&value.shares.every(share=>isRecord(share)&&typeof share.name==='string'&&share.name.trim().length>0&&isMoney(share.amount)&&typeof share.settled==='boolean')&&value.shares.reduce<number>((sum,share)=>sum+Math.round(Number(isRecord(share)?share.amount:0)*100),0)<=Math.round(Number(value.total)*100);
const isPreferences=(value:unknown):value is UserPreferences=>isRecord(value)&&typeof value.displayName==='string'&&value.currency==='BDT'&&isMoney(value.dailyBudget)&&(value.theme==='light'||value.theme==='dark'||value.theme==='system')&&(value.weekStart==='sunday'||value.weekStart==='monday')&&['cash','bkash','nagad','bank','other'].includes(String(value.paymentMethod))&&typeof value.notifications==='boolean'&&['Asia/Dhaka','UTC','Asia/Kolkata','Europe/London','America/New_York'].includes(String(value.timezone));
function isArrayOf<T>(value:unknown,guard:(item:unknown)=>item is T):value is T[]{
  return Array.isArray(value)&&value.every(guard);
}

export function parseBackup(text:string,userId:string):BackupData{
  let parsed:unknown;
  try{parsed=JSON.parse(text)}catch{throw new Error('This backup file is not valid JSON.')}
  if(!isRecord(parsed)||parsed.format!=='spendwise-backup'||parsed.version!==1||!isRecord(parsed.data))throw new Error('This is not a supported SpendWise backup file.');
  const data=parsed.data;
  if(data.userId!==userId)throw new Error('This backup belongs to a different SpendWise account.');
  if(!isArrayOf(data.transactions,isTransaction)||!isArrayOf(data.budgets,isBudget)||!isArrayOf(data.loans,isLoan)||!isArrayOf(data.bills,isBill)||!isArrayOf(data.sharedExpenses,isSharedExpense)||!isPreferences(data.preferences))throw new Error('The backup file is missing required data.');
  return {
    userId,
    transactions:data.transactions,
    budgets:data.budgets,
    loans:data.loans,
    bills:data.bills,
    sharedExpenses:data.sharedExpenses,
    preferences:data.preferences,
  };
}

export function mergeBackupData(current:OfflineState,incoming:BackupData):OfflineState{
  if(current.userId!==incoming.userId)throw new Error('This backup belongs to a different SpendWise account.');
  const byId=<T extends {id:string}>(existing:T[],added:T[])=>{
    const known=new Set(existing.map(item=>item.id));
    return [...existing,...added.filter(item=>!known.has(item.id))];
  };
  return {
    ...current,
    transactions:byId(current.transactions,incoming.transactions),
    budgets:byId(current.budgets,incoming.budgets),
    loans:byId(current.loans||[],incoming.loans),
    bills:byId(current.bills||[],incoming.bills),
    sharedExpenses:byId(current.sharedExpenses||[],incoming.sharedExpenses),
  };
}

export async function exportBackupFile(backup:BackupFile|EncryptedBackupFile){
  const content=JSON.stringify(backup,null,2);
  if(Capacitor.isNativePlatform()){
    const {uri}=await Filesystem.writeFile({path:'spendwise-backup.json',data:content,directory:Directory.Cache,encoding:Encoding.UTF8});
    await Share.share({title:'SpendWise backup',text:'Your SpendWise financial data backup.',files:[uri],dialogTitle:'Save SpendWise backup'});
    return;
  }
  const url=URL.createObjectURL(new Blob([content],{type:'application/json'}));
  const link=document.createElement('a');
  link.href=url;
  link.download='spendwise-backup.json';
  link.click();
  URL.revokeObjectURL(url);
}
