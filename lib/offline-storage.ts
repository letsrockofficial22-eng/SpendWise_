import type {Budget,Loan,RecurringBill,SharedExpense,Transaction,UserPreferences} from '../types';

export type PendingChange=
  |{id:string;userId:string;type:'transaction.save';value:Transaction}
  |{id:string;userId:string;type:'transaction.delete';value:string}
  |{id:string;userId:string;type:'budget.save';value:Budget}
  |{id:string;userId:string;type:'budget.delete';value:string}
  |{id:string;userId:string;type:'loan.save';value:Loan}
  |{id:string;userId:string;type:'loan.delete';value:string}
  |{id:string;userId:string;type:'bill.save';value:RecurringBill}
  |{id:string;userId:string;type:'bill.delete';value:string}
  |{id:string;userId:string;type:'sharedExpense.save';value:SharedExpense}
  |{id:string;userId:string;type:'sharedExpense.delete';value:string}
  |{id:string;userId:string;type:'profile.save';value:UserPreferences};

export interface OfflineState {
  userId:string;
  transactions:Transaction[];
  budgets:Budget[];
  loans:Loan[];
  bills:RecurringBill[];
  sharedExpenses:SharedExpense[];
  preferences:UserPreferences;
  pending:PendingChange[];
}

const databaseName='spendwise-offline';
const storeName='accounts';
const rememberedAccountKey='spendwise-offline-account';
let databasePromise:Promise<IDBDatabase>|undefined;

export function rememberOfflineAccount(userId:string){
  if(typeof localStorage!=='undefined')localStorage.setItem(rememberedAccountKey,userId);
}

export function getRememberedOfflineAccount(){
  return typeof localStorage==='undefined'?null:localStorage.getItem(rememberedAccountKey);
}

export function clearRememberedOfflineAccount(){
  if(typeof localStorage!=='undefined')localStorage.removeItem(rememberedAccountKey);
}

function database(){
  if(typeof indexedDB==='undefined')return Promise.reject(new Error('Local offline storage is unavailable in this browser.'));
  if(!databasePromise){
    databasePromise=new Promise((resolve,reject)=>{
      const request=indexedDB.open(databaseName,1);
      request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(storeName))request.result.createObjectStore(storeName,{keyPath:'userId'})};
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>{databasePromise=undefined;reject(request.error||new Error('Could not open local offline storage.'))};
      request.onblocked=()=>{databasePromise=undefined;reject(new Error('Local offline storage is blocked by another app tab.'))};
    });
  }
  return databasePromise;
}

export async function readOfflineState(userId:string):Promise<OfflineState|undefined>{
  const db=await database();
  return new Promise((resolve,reject)=>{
    const transaction=db.transaction(storeName,'readonly');
    const request=transaction.objectStore(storeName).get(userId);
    request.onsuccess=()=>resolve(request.result as OfflineState|undefined);
    request.onerror=()=>reject(request.error||new Error('Could not read local offline data.'));
    transaction.onabort=()=>reject(transaction.error||new Error('Could not read local offline data.'));
  });
}

export async function writeOfflineState(state:OfflineState):Promise<void>{
  const db=await database();
  return new Promise((resolve,reject)=>{
    const transaction=db.transaction(storeName,'readwrite');
    transaction.objectStore(storeName).put(state);
    transaction.oncomplete=()=>resolve();
    transaction.onerror=()=>reject(transaction.error||new Error('Could not save local offline data.'));
    transaction.onabort=()=>reject(transaction.error||new Error('Could not save local offline data.'));
  });
}

export async function deleteOfflineState(userId:string):Promise<void>{
  const db=await database();
  return new Promise((resolve,reject)=>{
    const transaction=db.transaction(storeName,'readwrite');
    transaction.objectStore(storeName).delete(userId);
    transaction.oncomplete=()=>resolve();
    transaction.onerror=()=>reject(transaction.error||new Error('Could not erase local account data.'));
    transaction.onabort=()=>reject(transaction.error||new Error('Could not erase local account data.'));
  });
}

export function applyPendingChanges(state:OfflineState,changes:PendingChange[]):OfflineState{
  return changes.filter(change=>change.userId===state.userId).reduce<OfflineState>((current,change)=>{
    switch(change.type){
      case 'transaction.save':
        return {...current,transactions:[change.value,...current.transactions.filter(item=>item.id!==change.value.id)]};
      case 'transaction.delete':
        return {...current,transactions:current.transactions.filter(item=>item.id!==change.value)};
      case 'budget.save':
        return {...current,budgets:[change.value,...current.budgets.filter(item=>item.id!==change.value.id)]};
      case 'budget.delete':
        return {...current,budgets:current.budgets.filter(item=>item.id!==change.value)};
      case 'loan.save':
        return {...current,loans:[change.value,...current.loans.filter(item=>item.id!==change.value.id)]};
      case 'loan.delete':
        return {...current,loans:current.loans.filter(item=>item.id!==change.value)};
      case 'bill.save':
        return {...current,bills:[change.value,...current.bills.filter(item=>item.id!==change.value.id)]};
      case 'bill.delete':
        return {...current,bills:current.bills.filter(item=>item.id!==change.value)};
      case 'sharedExpense.save':
        return {...current,sharedExpenses:[change.value,...current.sharedExpenses.filter(item=>item.id!==change.value.id)]};
      case 'sharedExpense.delete':
        return {...current,sharedExpenses:current.sharedExpenses.filter(item=>item.id!==change.value)};
      case 'profile.save':
        return {...current,preferences:change.value};
    }
  },state);
}

export function queuePendingChange(state:OfflineState,change:PendingChange):OfflineState{
  return {
    ...applyPendingChanges(state,[change]),
    pending:[...state.pending,change],
  };
}
