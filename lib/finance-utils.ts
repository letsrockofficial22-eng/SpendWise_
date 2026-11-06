import type {RecurringBill,SharedExpense} from '../types';

export function isValidMoney(amount:number){
  return Number.isFinite(amount)&&amount>0&&amount<=9999999999.99&&Math.abs(amount-Math.round(amount*100)/100)<1e-9;
}

export function splitAmountEqually(total:number,names:string[]):{name:string;amount:number;settled:boolean}[]{
  const people=names.map(name=>name.trim()).filter(Boolean);
  if(!isValidMoney(total)||people.length===0)throw new Error('Enter a valid total and at least one participant.');
  const cents=Math.round(total*100);
  const base=Math.floor(cents/people.length);
  let remainder=cents-base*people.length;
  return people.map(name=>{
    const amount=base+(remainder-->0?1:0);
    return {name,amount:amount/100,settled:false};
  });
}

export function advanceBillDate(bill:RecurringBill):string{
  const [year,month,day]=bill.nextDue.split('-').map(Number);
  const date=new Date(Date.UTC(year,month-1,day));
  if(bill.frequency==='weekly')date.setUTCDate(date.getUTCDate()+7);
  if(bill.frequency==='monthly'){
    const lastDayOfMonth=new Date(Date.UTC(year,month,0)).getUTCDate();
    const targetMonth=date.getUTCMonth()+1;
    date.setUTCDate(1);
    date.setUTCMonth(targetMonth);
    const lastDayOfTargetMonth=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();
    date.setUTCDate(day===lastDayOfMonth?lastDayOfTargetMonth:Math.min(day,lastDayOfTargetMonth));
  }
  if(bill.frequency==='yearly'){
    date.setUTCFullYear(year+1);
    if(date.getUTCMonth()!==month-1)date.setUTCDate(0);
  }
  return date.toISOString().slice(0,10);
}

export function nextBillDateAfter(bill:RecurringBill,date:string):string{
  let next=advanceBillDate(bill);
  for(let attempts=0;next<=date&&attempts<1200;attempts++)next=advanceBillDate({...bill,nextDue:next});
  if(next<=date)throw new Error('Could not calculate the next bill date.');
  return next;
}

export function localReminderTime(dueDate:string,now=new Date()):Date|undefined{
  const [year,month,day]=dueDate.split('-').map(Number);
  const reminder=new Date(year,month-1,day-1,9,0,0,0);
  return reminder>now?reminder:undefined;
}

export function mergeUniqueById<T extends {id:string}>(existing:T[],imported:T[]):T[]{
  const ids=new Set(existing.map(item=>item.id));
  return [...existing,...imported.filter(item=>!ids.has(item.id))];
}

export interface SharedExpenseSummary {
  total:number;
  settled:number;
  outstanding:number;
}

export function sharedExpenseSummary(expense:SharedExpense):SharedExpenseSummary{
  const settled=expense.shares.reduce((sum,share)=>sum+(share.settled?share.amount:0),0);
  const owed=expense.shares.reduce((sum,share)=>sum+share.amount,0);
  return {total:expense.total,settled,outstanding:Math.max(0,owed-settled)};
}

export function monthBounds(month:string){
  const [year,monthNumber]=month.split('-').map(Number);
  return {start:`${month}-01`,end:new Date(Date.UTC(year,monthNumber,0)).toISOString().slice(0,10)};
}

export function transactionMatchesSearch(transaction:{category:string;subcategory?:string;description?:string;notes?:string;paymentMethod:string},query:string){
  const needle=query.trim().toLocaleLowerCase();
  if(!needle)return true;
  return [transaction.category,transaction.subcategory,transaction.description,transaction.notes,transaction.paymentMethod]
    .some(value=>value?.toLocaleLowerCase().includes(needle));
}
