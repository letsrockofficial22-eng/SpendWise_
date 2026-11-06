import {browserClient} from './supabase/client';import {Transaction,Budget,Loan,RecurringBill,SharedExpense,UserPreferences} from '../types';import {totalIncome,totalExpenses,currentBalance,spendingByCategory} from './calculations';
import type {PendingChange} from './offline-storage';
const db=()=>browserClient();
type TransactionRow={id:string;type:'income'|'expense';amount:number;category:string;subcategory:string|null;description:string|null;payment_method:Transaction['paymentMethod'];transaction_date:string;notes:string|null;loan_id:string|null;receipt_path:string|null};
type BudgetRow={id:string;name:string;amount:number;period:'daily'|'monthly';category:string|null;month:string|null;created_at:string};
type ProfileRow={display_name:string|null;currency:'BDT';daily_budget:number;theme:UserPreferences['theme'];week_start:UserPreferences['weekStart'];payment_method:UserPreferences['paymentMethod'];notifications:boolean;timezone:string};
type LoanRow={id:string;direction:Loan['direction'];person:string;principal:number;remaining:number;due_date:string;notes:string|null};
type BillRow={id:string;name:string;amount:number;category:string;frequency:RecurringBill['frequency'];next_due:string;reminder:boolean;transaction_type:'income'|'expense'};
type SharedExpenseRow={id:string;title:string;total:number;paid_by:string;shares:SharedExpense['shares'];created_at:string};
const trans=(r:TransactionRow):Transaction=>({id:r.id,type:r.type,amount:Number(r.amount),category:r.category,subcategory:r.subcategory||undefined,description:r.description||undefined,paymentMethod:r.payment_method,date:r.transaction_date,notes:r.notes||undefined,loanId:r.loan_id||undefined,receiptPath:r.receipt_path||undefined});
const budget=(r:BudgetRow):Budget=>({id:r.id,name:r.name,amount:Number(r.amount),period:r.period,category:r.category||undefined,month:r.month||undefined,createdAt:r.created_at});
const transactionPayload=(t:Transaction)=>({id:t.id,type:t.type,amount:t.amount,category:t.category,subcategory:t.subcategory||null,description:t.description||null,payment_method:t.paymentMethod,transaction_date:t.date,notes:t.notes||null,loan_id:t.loanId||null,receipt_path:t.receiptPath||null});
const budgetPayload=(b:Budget)=>({id:b.id,name:b.name,amount:b.amount,period:b.period,category:b.category||null,month:b.month||null});
const loan=(r:LoanRow):Loan=>({id:r.id,direction:r.direction,person:r.person,principal:Number(r.principal),remaining:Number(r.remaining),dueDate:r.due_date,notes:r.notes||undefined});
const loanPayload=(l:Loan)=>({id:l.id,direction:l.direction,person:l.person,principal:l.principal,remaining:l.remaining,due_date:l.dueDate,notes:l.notes||null});
const bill=(r:BillRow):RecurringBill=>({id:r.id,name:r.name,amount:Number(r.amount),category:r.category,frequency:r.frequency,nextDue:r.next_due,reminder:r.reminder,type:r.transaction_type||'expense'});
const billPayload=(b:RecurringBill)=>({id:b.id,name:b.name,amount:b.amount,category:b.category,frequency:b.frequency,next_due:b.nextDue,reminder:b.reminder,transaction_type:b.type||'expense'});
const sharedExpense=(r:SharedExpenseRow):SharedExpense=>({id:r.id,title:r.title,total:Number(r.total),paidBy:r.paid_by,shares:r.shares,createdAt:r.created_at});
const sharedExpensePayload=(e:SharedExpense)=>({id:e.id,title:e.title,total:e.total,paid_by:e.paidBy,shares:e.shares,created_at:e.createdAt});
export function validateTransaction(t:Transaction){if(!Number.isFinite(t.amount)||t.amount<=0||t.amount>9999999999.99||Math.abs(t.amount-Math.round(t.amount*100)/100)>1e-9)throw new Error('Enter a valid amount greater than zero with at most two decimal places.');if(!t.category.trim()||!Number.isFinite(Date.parse(t.date)))throw new Error('Choose a category and valid date.');}
export async function fetchTransactions(){const all:Transaction[]=[];for(let offset=0;;offset+=1000){const {data,error}=await db().from('transactions').select('*').order('transaction_date',{ascending:false}).order('id').range(offset,offset+999);if(error)throw error;all.push(...(data as TransactionRow[]).map(trans));if(data.length<1000)break}return all}
export async function createTransaction(t:Transaction,userId?:string){validateTransaction(t);const payload=transactionPayload(t);const {data,error}=await db().from('transactions').upsert(userId?{...payload,user_id:userId}:payload).select().single();if(error)throw error;return trans(data as TransactionRow)}
export async function updateTransaction(t:Transaction){validateTransaction(t);const {data,error}=await db().from('transactions').upsert(transactionPayload(t)).select().single();if(error)throw error;return trans(data as TransactionRow)}
export async function deleteTransaction(id:string){const client=db();const {data,error:readError}=await client.from('transactions').select('receipt_path').eq('id',id).maybeSingle();if(readError)throw readError;if(data?.receipt_path){const {error}=await client.storage.from('receipts').remove([data.receipt_path]);if(error)throw error}const {error}=await client.from('transactions').delete().eq('id',id);if(error)throw error}
export async function fetchBudgets(){const all:Budget[]=[];for(let offset=0;;offset+=1000){const {data,error}=await db().from('budgets').select('*').order('created_at',{ascending:false}).order('id').range(offset,offset+999);if(error)throw error;all.push(...(data as BudgetRow[]).map(budget));if(data.length<1000)break}return all}
export async function createBudget(b:Budget,userId?:string){const payload=budgetPayload(b);const {data,error}=await db().from('budgets').upsert(userId?{...payload,user_id:userId}:payload).select().single();if(error)throw error;return budget(data as BudgetRow)}
export async function updateBudget(b:Budget){const {data,error}=await db().from('budgets').upsert(budgetPayload(b)).select().single();if(error)throw error;return budget(data as BudgetRow)}
export async function deleteBudget(id:string){const {error}=await db().from('budgets').delete().eq('id',id);if(error)throw error}
export async function fetchLoans(){const {data,error}=await db().from('loans').select('*').order('due_date').order('id');if(error)throw error;return (data as LoanRow[]).map(loan)}
export async function saveLoan(l:Loan,userId:string){const {data,error}=await db().from('loans').upsert({...loanPayload(l),user_id:userId}).select().single();if(error)throw error;return loan(data as LoanRow)}
export async function deleteLoan(id:string,userId:string){const {error}=await db().from('loans').delete().eq('id',id).eq('user_id',userId);if(error)throw error}
export async function fetchBills(){const {data,error}=await db().from('recurring_bills').select('*').order('next_due').order('id');if(error)throw error;return (data as BillRow[]).map(bill)}
export async function saveBill(b:RecurringBill,userId:string){const {data,error}=await db().from('recurring_bills').upsert({...billPayload(b),user_id:userId}).select().single();if(error)throw error;return bill(data as BillRow)}
export async function deleteBill(id:string,userId:string){const {error}=await db().from('recurring_bills').delete().eq('id',id).eq('user_id',userId);if(error)throw error}
export async function fetchSharedExpenses(){const {data,error}=await db().from('shared_expenses').select('*').order('created_at',{ascending:false}).order('id');if(error)throw error;return (data as SharedExpenseRow[]).map(sharedExpense)}
export async function saveSharedExpense(e:SharedExpense,userId:string){const {data,error}=await db().from('shared_expenses').upsert({...sharedExpensePayload(e),user_id:userId}).select().single();if(error)throw error;return sharedExpense(data as SharedExpenseRow)}
export async function deleteSharedExpense(id:string,userId:string){const {error}=await db().from('shared_expenses').delete().eq('id',id).eq('user_id',userId);if(error)throw error}
export async function fetchProfile(){const {data,error}=await db().from('profiles').select('*').single();if(error)throw error;const p=data as ProfileRow;return {displayName:p.display_name||'Student',currency:p.currency,dailyBudget:Number(p.daily_budget),theme:p.theme,weekStart:p.week_start,paymentMethod:p.payment_method,notifications:p.notifications,timezone:p.timezone} satisfies UserPreferences}
export async function updateProfile(p:UserPreferences,userId?:string){let query=db().from('profiles').update({display_name:p.displayName,currency:p.currency,daily_budget:p.dailyBudget,theme:p.theme,week_start:p.weekStart,payment_method:p.paymentMethod,notifications:p.notifications,timezone:p.timezone});if(userId)query=query.eq('id',userId);const {data,error}=await query.select('id').single();if(error||!data)throw error||new Error('Profile not found')}
export async function syncPendingChange(change:PendingChange){
  const {data,error}=await db().auth.getSession();
  if(error)throw error;
  if(data.session?.user.id!==change.userId)throw new Error('Pending offline changes belong to a different account. Sign in to that account to sync them.');
  switch(change.type){
    case 'transaction.save':
      await createTransaction(change.value,change.userId);
      return;
    case 'transaction.delete':
      await deleteTransaction(change.value);
      return;
    case 'budget.save':
      await createBudget(change.value,change.userId);
      return;
    case 'budget.delete':
      {const {error}=await db().from('budgets').delete().eq('id',change.value).eq('user_id',change.userId);if(error)throw error}
      return;
    case 'loan.save':
      await saveLoan(change.value,change.userId);
      return;
    case 'loan.delete':
      await deleteLoan(change.value,change.userId);
      return;
    case 'bill.save':
      await saveBill(change.value,change.userId);
      return;
    case 'bill.delete':
      await deleteBill(change.value,change.userId);
      return;
    case 'sharedExpense.save':
      await saveSharedExpense(change.value,change.userId);
      return;
    case 'sharedExpense.delete':
      await deleteSharedExpense(change.value,change.userId);
      return;
    case 'profile.save':
      await updateProfile(change.value,change.userId);
  }
}
export async function fetchFinancialSummaries(){const t=await fetchTransactions();return {income:totalIncome(t),expenses:totalExpenses(t),balance:currentBalance(t),categories:spendingByCategory(t)}}
