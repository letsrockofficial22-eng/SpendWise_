'use client';

import {useRef,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,CalendarDays,Check,Download,HardDriveDownload,Landmark,Plus,Trash2,ArrowRight,UsersRound,ChartNoAxesCombined,FileText} from 'lucide-react';
import type {Loan,RecurringBill,SharedExpense,Transaction} from '../types';
import {useStore} from './store';
import {money,totalExpenses,totalIncome} from '../lib/calculations';
import {isValidMoney,localReminderTime,monthBounds,nextBillDateAfter,sharedExpenseSummary,splitAmountEqually,transactionMatchesSearch} from '../lib/finance-utils';
import {createBackup,encryptBackup,exportBackupFile,parseBackupFile} from '../lib/backup';
import {cancelReminder,scheduleReminder} from '../lib/reminders';
import {dateKey,today} from '../lib/date-utils';
import {exportCSV} from '../lib/csv-export';

const links=[['Overview','/dashboard'],['Transactions','/transactions'],['Budgets','/budgets'],['Reports','/reports'],['Loans & bills','/loans'],['Shared expenses','/shared-expenses'],['Monthly summary','/monthly-summary'],['Backup & export','/backup']] as const;

function FeatureFrame({title,subtitle,children}:{title:string;subtitle:string;children:React.ReactNode}){
  const activeHref=title==='Loans & bills'?'/loans':title==='Shared expenses'?'/shared-expenses':title==='Monthly summary'?'/monthly-summary':title==='Backup & export'?'/backup':'';
  return <div className="feature-app"><header className="feature-header"><Link href="/dashboard" className="brand"><span className="brand-icon"><Landmark size={18}/></span> spendwise<span className="brand-dot">.</span></Link><Link href="/dashboard" className="button outline small"><ArrowLeft size={15}/> Workspace</Link></header><aside className="feature-sidebar"><nav>{links.map(([label,href])=><Link key={href} href={href} className={href===activeHref?'active':''}>{label}</Link>)}</nav></aside><main className="feature-content"><div className="feature-heading"><span className="eyebrow">SPENDWISE TOOLS</span><h1>{title}</h1><p>{subtitle}</p></div>{children}</main></div>;
}

export function FinanceToolsPage(){
  const tools=[
    {title:'Loans & bills',description:'Track loans to repay or money lent, plus recurring bills and due-date reminders.',href:'/loans',Icon:Landmark},
    {title:'Shared expenses',description:'Split costs with participant names and keep settlement status up to date.',href:'/shared-expenses',Icon:UsersRound},
    {title:'Monthly summary',description:'Review a calendar month of income, expenses, and category totals.',href:'/monthly-summary',Icon:ChartNoAxesCombined},
    {title:'Backup & export',description:'Export transactions or make and restore a full account backup.',href:'/backup',Icon:FileText},
  ];
  return <FeatureFrame title="Finance tools" subtitle="Helpful tools for planning, sharing, and protecting your financial records.">
    <div className="tool-grid">{tools.map(({title,description,href,Icon})=><Link className="card tool-card" key={href} href={href}><span className="tool-icon"><Icon size={20}/></span><b>{title}</b><p>{description}</p><span className="text-link">Open tool <ArrowRight size={14}/></span></Link>)}</div>
  </FeatureFrame>;
}

function Panel({title,children,action}:{title:string;children:React.ReactNode;action?:React.ReactNode}){
  return <section className="card feature-panel"><div className="card-head"><h2>{title}</h2>{action}</div>{children}</section>;
}

function InputField({label,...props}:{label:string}&React.InputHTMLAttributes<HTMLInputElement>){
  return <label className="feature-field">{label}<input {...props}/></label>;
}

function SelectField({label,children,...props}:{label:string;children:React.ReactNode}&React.SelectHTMLAttributes<HTMLSelectElement>){
  return <label className="feature-field">{label}<select {...props}>{children}</select></label>;
}

export function LoansBillsPage(){
  const {loans,bills,preferences,saveLoan,payLoan,removeLoan,saveBill,removeBill,payBill,toast}=useStore();
  const [loanForm,setLoanForm]=useState(false);
  const [billForm,setBillForm]=useState(false);
  const [loanEditing,setLoanEditing]=useState<Loan>();
  const [billEditing,setBillEditing]=useState<RecurringBill>();
  const [loanDirection,setLoanDirection]=useState<Loan['direction']>('repay');
  const [person,setPerson]=useState('');
  const [principal,setPrincipal]=useState('');
  const [dueDate,setDueDate]=useState(today());
  const [loanNotes,setLoanNotes]=useState('');
  const [billName,setBillName]=useState('');
  const [billAmount,setBillAmount]=useState('');
  const [billCategory,setBillCategory]=useState('Bills');
  const [frequency,setFrequency]=useState<RecurringBill['frequency']>('monthly');
  const [billDue,setBillDue]=useState(today());
  const [billReminder,setBillReminder]=useState(true);
  const [billType,setBillType]=useState<'income'|'expense'>('expense');
  const [paymentValues,setPaymentValues]=useState<Record<string,string>>({});

  function startLoan(item?:Loan){
    setLoanEditing(item);
    setLoanDirection(item?.direction||'repay');
    setPerson(item?.person||'');
    setPrincipal(item?String(item.principal):'');
    setDueDate(item?.dueDate||today());
    setLoanNotes(item?.notes||'');
    setLoanForm(true);
  }
  async function submitLoan(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    const amount=Number(principal);
    if(!person.trim()||!isValidMoney(amount)||!dueDate){toast('Enter the lender or borrower, a valid amount (up to two decimal places), and a due date.');return}
    const paid=loanEditing?loanEditing.principal-loanEditing.remaining:0;
    const item:Loan={id:loanEditing?.id||crypto.randomUUID(),direction:loanDirection,person:person.trim(),principal:amount,remaining:Math.max(0,Math.round((amount-paid)*100)/100),dueDate,notes:loanNotes.trim()||undefined};
    try{
      await saveLoan(item);
      try{
        const scheduled=await scheduleReminder('loan',item.id,`${item.direction==='repay'?'Loan payment to':'Repayment from'} ${item.person}`,item.dueDate,item.remaining>0&&preferences.notifications);
        toast(scheduled?'Loan saved; reminder set for one day before the due date.':item.dueDate<=today()?'Loan saved. Its due date is today or past, so no future reminder was scheduled.':!preferences.notifications?'Loan saved. Enable notifications in Settings to receive reminders.':'Loan saved. Allow notifications on this device to receive reminders.');
      }catch(error){toast(error instanceof Error?`Loan saved, but reminder scheduling failed: ${error.message}`:'Loan saved, but reminder scheduling failed.')}
      setLoanForm(false);
    }catch(error){toast(error instanceof Error?`Could not save this loan: ${error.message}`:'Could not save this loan. Try again.')}
  }
  async function recordLoanPayment(item:Loan){
    const amount=Number(paymentValues[item.id]);
    if(!isValidMoney(amount)||amount>item.remaining){toast('Enter a valid payment (up to two decimal places) no more than the remaining balance.');return}
    const next={...item,remaining:Math.round((item.remaining-amount)*100)/100};
    try{
      const transaction:Transaction={id:crypto.randomUUID(),type:item.direction==='repay'?'expense':'income',amount,date:new Date().toISOString(),category:'Loan payment',description:`${item.direction==='repay'?'Repayment to':'Repayment from'} ${item.person}`,paymentMethod:preferences.paymentMethod,loanId:item.id};
      await payLoan(next,transaction);
      setPaymentValues(values=>({...values,[item.id]:''}));
      try{
        if(next.remaining===0)await cancelReminder('loan',item.id);
        else await scheduleReminder('loan',item.id,`${item.direction==='repay'?'Loan payment to':'Repayment from'} ${item.person}`,item.dueDate,preferences.notifications);
        toast('Loan balance updated.');
      }catch(error){toast(error instanceof Error?`Loan balance updated, but its reminder could not be updated: ${error.message}`:'Loan balance updated, but its reminder could not be updated.')}
    }catch(error){toast(error instanceof Error?error.message:'Could not update this loan. Try again.')}
  }
  async function deleteLoanItem(item:Loan){
    if(!window.confirm(`Delete the loan record for ${item.person}?`))return;
    try{
      await removeLoan(item.id);
      try{await cancelReminder('loan',item.id);toast('Loan record deleted.')}
      catch(error){toast(error instanceof Error?`Loan deleted, but its reminder could not be canceled: ${error.message}`:'Loan deleted, but its reminder could not be canceled.')}
    }catch(error){toast(error instanceof Error?error.message:'Could not delete this loan.')}
  }
  function startBill(item?:RecurringBill){
    setBillEditing(item);
    setBillName(item?.name||'');
    setBillAmount(item?String(item.amount):'');
    setBillCategory(item?.category||'Bills');
    setFrequency(item?.frequency||'monthly');
    setBillDue(item?.nextDue||today());
    setBillReminder(item?.reminder??true);
    setBillType(item?.type||'expense');
    setBillForm(true);
  }
  async function submitBill(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    const amount=Number(billAmount);
    if(!billName.trim()||!isValidMoney(amount)||!billCategory.trim()||!billDue){toast('Enter a bill name, valid amount (up to two decimal places), category, and due date.');return}
    const item:RecurringBill={id:billEditing?.id||crypto.randomUUID(),name:billName.trim(),amount,category:billCategory.trim(),frequency,nextDue:billDue,reminder:billReminder,type:billType};
    try{
      await saveBill(item);
      const scheduled=await scheduleReminder('bill',item.id,item.name,item.nextDue,item.reminder&&preferences.notifications);
      toast(item.reminder&&!scheduled&&preferences.notifications?'Bill saved, but its reminder was not scheduled. Check notification permission and due date.':'Recurring bill saved.');
      setBillForm(false);
    }catch(error){toast(error instanceof Error?`Bill saved, but reminder scheduling failed: ${error.message}`:'Could not save this bill. Try again.')}
  }
  async function markBillPaid(item:RecurringBill){
    try{
      const nextDue=nextBillDateAfter(item,today());
      const next={...item,nextDue};
      const transaction:Transaction={id:crypto.randomUUID(),type:item.type||'expense',amount:item.amount,category:item.category,description:`${item.type==='income'?'Income received':'Bill payment'}: ${item.name}`,paymentMethod:preferences.paymentMethod,date:new Date().toISOString()};
      await payBill(next,transaction);
      try{
        await scheduleReminder('bill',next.id,next.name,next.nextDue,next.reminder&&preferences.notifications);
        toast(`${item.name} marked paid and added to your transactions.`);
      }catch(error){toast(error instanceof Error?`${item.name} was paid and recorded, but its next reminder could not be set: ${error.message}`:`${item.name} was paid and recorded, but its next reminder could not be set.`)}
    }catch(error){toast(error instanceof Error?error.message:'Could not mark this bill paid. Try again.')}
  }
  async function deleteBillItem(item:RecurringBill){
    if(!window.confirm(`Delete the recurring bill "${item.name}"?`))return;
    try{
      await removeBill(item.id);
      try{await cancelReminder('bill',item.id);toast('Recurring bill deleted.')}
      catch(error){toast(error instanceof Error?`Bill deleted, but its reminder could not be canceled: ${error.message}`:'Bill deleted, but its reminder could not be canceled.')}
    }catch(error){toast(error instanceof Error?error.message:'Could not delete this bill.')}
  }

  return <FeatureFrame title="Loans & bills" subtitle="Keep repayment dates and regular bills in view—even while offline.">
    <Panel title="Loans to repay and money lent" action={<button className="button small" onClick={()=>startLoan()}><Plus size={15}/> Add loan</button>}>
      <p className="feature-note">Recording a loan payment updates the remaining balance and adds a linked income or expense transaction. The transaction remains if you later delete the loan record.</p>
      {loanForm&&<form className="feature-form" onSubmit={submitLoan}>
        <SelectField label="Loan type" value={loanDirection} onChange={event=>setLoanDirection(event.target.value as Loan['direction'])}><option value="repay">I need to repay</option><option value="lent">I lent money</option></SelectField>
        <InputField label={loanDirection==='repay'?'Lender':'Borrower'} value={person} onChange={event=>setPerson(event.target.value)} maxLength={100} required/>
        <InputField label="Amount (BDT)" type="number" step="0.01" min="0.01" value={principal} onChange={event=>setPrincipal(event.target.value)} required/>
        <InputField label="Due date" type="date" value={dueDate} onChange={event=>setDueDate(event.target.value)} required/>
        <InputField label="Notes" value={loanNotes} onChange={event=>setLoanNotes(event.target.value)} maxLength={2000}/>
        <button className="button small" type="submit"><Check size={15}/>{loanEditing?'Save loan':'Add loan'}</button><button className="button outline small" type="button" onClick={()=>setLoanForm(false)}>Cancel</button>
      </form>}
      <div className="feature-list">{loans.length?loans.map(item=><article className="feature-item" key={item.id}>
        <div className="feature-item-main"><b>{item.direction==='repay'?'Repay to':'Lent to'} {item.person}</b><span>{money(item.remaining)} remaining of {money(item.principal)} · due {item.dueDate}</span><small>{item.remaining>0&&preferences.notifications?'Reminder enabled; Android permission required':'No upcoming reminder enabled'}</small>{item.notes&&<small>{item.notes}</small>}</div>
        <div className="feature-item-actions">{item.remaining>0&&<><input aria-label={`Payment amount for ${item.person}`} className="compact-input" type="number" min="0.01" max={item.remaining} step="0.01" placeholder="Payment" value={paymentValues[item.id]||''} onChange={event=>setPaymentValues(values=>({...values,[item.id]:event.target.value}))}/><button className="button outline small" onClick={()=>void recordLoanPayment(item)}>Update balance</button></>}<button className="icon-button" aria-label={`Edit loan for ${item.person}`} onClick={()=>startLoan(item)}>Edit</button><button className="icon-button danger-text" aria-label={`Delete loan for ${item.person}`} onClick={()=>void deleteLoanItem(item)}><Trash2 size={16}/></button></div>
      </article>):<div className="empty small">No loans recorded yet.</div>}</div>
    </Panel>
    <Panel title="Recurring income and bills" action={<button className="button small" onClick={()=>startBill()}><Plus size={15}/> Add recurring item</button>}>
      <p className="feature-note">When reminders are enabled and permission is granted, this Android device schedules a reminder about 9:00 AM the day before. Recording an item creates the matching income or expense transaction and advances its due date.</p>
      {billForm&&<form className="feature-form" onSubmit={submitBill}>
        <InputField label="Bill name" value={billName} onChange={event=>setBillName(event.target.value)} maxLength={100} required/>
        <InputField label="Amount (BDT)" type="number" step="0.01" min="0.01" value={billAmount} onChange={event=>setBillAmount(event.target.value)} required/>
        <SelectField label="Income or expense" value={billType} onChange={event=>setBillType(event.target.value as 'income'|'expense')}><option value="expense">Expense</option><option value="income">Income</option></SelectField>
        <InputField label="Category" value={billCategory} onChange={event=>setBillCategory(event.target.value)} maxLength={100} required/>
        <SelectField label="Repeats" value={frequency} onChange={event=>setFrequency(event.target.value as RecurringBill['frequency'])}><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></SelectField>
        <InputField label="Next due date" type="date" value={billDue} onChange={event=>setBillDue(event.target.value)} required/>
        <label className="feature-checkbox"><input type="checkbox" checked={billReminder} onChange={event=>setBillReminder(event.target.checked)}/> Remind me one day before</label>
        <button className="button small" type="submit"><Check size={15}/>{billEditing?'Save bill':'Add bill'}</button><button className="button outline small" type="button" onClick={()=>setBillForm(false)}>Cancel</button>
      </form>}
      <div className="feature-list">{bills.length?bills.map(item=><article className="feature-item" key={item.id}>
        <div className="feature-item-main"><b>{item.type==='income'?'Income: ':''}{item.name}</b><span>{money(item.amount)} · {item.frequency} · next due {item.nextDue}</span><small>{item.reminder&&preferences.notifications&&localReminderTime(item.nextDue)?'Reminder enabled for the day before; Android permission is required':'No upcoming reminder enabled'}</small></div>
        <div className="feature-item-actions"><button className="button small" onClick={()=>void markBillPaid(item)}>Mark paid</button><button className="icon-button" aria-label={`Edit ${item.name}`} onClick={()=>startBill(item)}>Edit</button><button className="icon-button danger-text" aria-label={`Delete ${item.name}`} onClick={()=>void deleteBillItem(item)}><Trash2 size={16}/></button></div>
      </article>):<div className="empty small">No recurring bills yet.</div>}</div>
    </Panel>
  </FeatureFrame>;
}

export function SharedExpensesPage(){
  const {sharedExpenses,preferences,saveSharedExpense,removeSharedExpense,toast}=useStore();
  const [form,setForm]=useState(false);
  const [title,setTitle]=useState('');
  const [total,setTotal]=useState('');
  const [people,setPeople]=useState('');
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    const amount=Number(total);
    try{
      const names=people.split(',').map(name=>name.trim()).filter(Boolean);
      if(!isValidMoney(amount))throw new Error('Enter a valid total with up to two decimal places.');
      if(names.length>100)throw new Error('A shared expense can include up to 100 other participants.');
      const normalized=new Set<string>();
      for(const name of names){
        const key=name.toLowerCase();
        if(key===preferences.displayName.trim().toLowerCase()||normalized.has(key))throw new Error('Enter each participant once; do not include your own name.');
        normalized.add(key);
      }
      const shares=splitAmountEqually(amount,[...names,preferences.displayName]).filter(share=>share.name.toLowerCase()!==preferences.displayName.trim().toLowerCase());
      const item:SharedExpense={id:crypto.randomUUID(),title:title.trim(),total:amount,paidBy:preferences.displayName,shares,createdAt:new Date().toISOString()};
      if(!title.trim()||names.length===0)throw new Error('Enter a title and at least one other participant.');
      await saveSharedExpense(item);
      setForm(false);setTitle('');setTotal('');setPeople('');
      toast('Shared expense saved.');
    }catch(error){toast(error instanceof Error?error.message:'Could not save this shared expense.')}
  }
  async function updateShare(item:SharedExpense,index:number){
    const shares=item.shares.map((share,i)=>i===index?{...share,settled:!share.settled}:share);
    try{await saveSharedExpense({...item,shares});toast('Settlement status updated.')}
    catch(error){toast(error instanceof Error?error.message:'Could not update settlement status.')}
  }
  async function deleteItem(item:SharedExpense){
    if(!window.confirm(`Delete shared expense "${item.title}"?`))return;
    try{await removeSharedExpense(item.id);toast('Shared expense deleted.')}
    catch(error){toast(error instanceof Error?error.message:'Could not delete this shared expense.')}
  }
  return <FeatureFrame title="Shared expenses" subtitle="Split a cost with people by name and keep track of who has settled their share.">
    <Panel title="Your expense splits" action={<button className="button small" onClick={()=>setForm(!form)}><Plus size={15}/> Add shared expense</button>}>
      <p className="feature-note">This tracks names and balances in your account only; it does not invite people or send them notifications.</p>
      {form&&<form className="feature-form" onSubmit={event=>void submit(event)}>
        <InputField label="What was shared?" value={title} onChange={event=>setTitle(event.target.value)} maxLength={100} required/>
        <InputField label="Total amount (BDT)" type="number" step="0.01" min="0.01" value={total} onChange={event=>setTotal(event.target.value)} required/>
        <InputField label="Other participants (comma separated)" placeholder="Alex, Sam" value={people} onChange={event=>setPeople(event.target.value)} required/>
        <p className="feature-note">The total is split evenly among everyone named and you; your share is not shown as owed to you.</p>
        <button className="button small" type="submit"><Check size={15}/>Save split</button><button className="button outline small" type="button" onClick={()=>setForm(false)}>Cancel</button>
      </form>}
      <div className="feature-list">{sharedExpenses.length?sharedExpenses.map(item=>{
        const summary=sharedExpenseSummary(item);
        return <article className="feature-item feature-item-block" key={item.id}>
          <div className="feature-item-main"><b>{item.title}</b><span>Total {money(item.total)} · paid by {item.paidBy} · {money(summary.outstanding)} owed</span></div>
          <button className="icon-button danger-text" aria-label={`Delete ${item.title}`} onClick={()=>void deleteItem(item)}><Trash2 size={16}/></button>
          <div className="share-list">{item.shares.map((share,index)=><div className="share-row" key={`${item.id}-${share.name}`}><span>{share.name}</span><b>{money(share.amount)}</b><button className={`settlement-button ${share.settled?'settled':''}`} onClick={()=>void updateShare(item,index)}>{share.settled?'Settled':'Mark settled'}</button></div>)}</div>
        </article>;
      }):<div className="empty small">No shared expenses yet.</div>}</div>
    </Panel>
  </FeatureFrame>;
}

export function MonthlySummaryPage(){
  const {transactions}=useStore();
  const [month,setMonth]=useState(today().slice(0,7));
  const bounds=monthBounds(month);
  const included=transactions.filter(transaction=>{
    const day=dateKey(transaction.date);
    return day>=bounds.start&&day<=bounds.end;
  });
  const income=totalIncome(included.filter(item=>item.type==='income'));
  const expenses=totalExpenses(included.filter(item=>item.type==='expense'));
  const net=Math.round((income-expenses)*100)/100;
  const byCategory=new Map<string,number>();
  included.filter(item=>item.type==='expense').forEach(item=>byCategory.set(item.category,(byCategory.get(item.category)||0)+item.amount));
  const categories=[...byCategory].sort((a,b)=>b[1]-a[1]);
  return <FeatureFrame title="Monthly summary" subtitle="Calendar-month income, spending, net change, and category totals.">
    <div className="card month-picker-card"><label><CalendarDays size={17}/> Choose month <input aria-label="Summary month" type="month" value={month} onChange={event=>event.target.value&&setMonth(event.target.value)}/></label></div>
    <div className="feature-stats"><Stat label="Income" amount={income}/><Stat label="Expenses" amount={expenses}/><Stat label="Net change" amount={net}/><Stat label="Transactions" amount={included.length}/></div>
    <Panel title={`${new Date(`${month}-01T12:00:00`).toLocaleDateString('en-US',{month:'long',year:'numeric'})} spending by category`}>
      {categories.length?<div className="summary-categories">{categories.map(([name,amount])=><div key={name}><span>{name}</span><b>{money(amount)}</b><i style={{width:`${expenses?Math.min(100,amount/expenses*100):0}%`}}/></div>)}</div>:<div className="empty small">No expenses recorded this month.</div>}
    </Panel>
  </FeatureFrame>;
}

function Stat({label,amount}:{label:string;amount:number}){
  return <section className="card feature-stat"><span>{label}</span><b>{typeof amount==='number'&&label!=='Transactions'?money(amount):amount}</b></section>;
}

export function BackupPage(){
  const {transactions,budgets,loans,bills,sharedExpenses,preferences,accountId,ready,restoreBackup,toast}=useStore();
  const fileInput=useRef<HTMLInputElement>(null);
  const [backupPassphrase,setBackupPassphrase]=useState('');
  const [backupPassphraseConfirm,setBackupPassphraseConfirm]=useState('');
  const [restorePassphrase,setRestorePassphrase]=useState('');
  async function exportJson(){
    try{
      const backup=await encryptBackup(createBackup({userId:accountId,transactions,budgets,loans,bills,sharedExpenses,preferences,pending:[]}),backupPassphrase);
      await exportBackupFile(backup);
      toast('Encrypted backup exported. Keep the passphrase somewhere safe.');
    }catch(error){toast(error instanceof Error?`Could not export backup: ${error.message}`:'Could not export backup.')}
  }
  async function importJson(file?:File){
    if(!file)return;
    try{
      const incoming=await parseBackupFile(await file.text(),accountId,restorePassphrase);
      const added=await restoreBackup(incoming);
      let reminderWarning='';
      try{
        const scheduled=await Promise.all([
          ...incoming.loans.filter(item=>item.remaining>0&&preferences.notifications).map(item=>scheduleReminder('loan',item.id,`${item.direction==='repay'?'Loan payment to':'Repayment from'} ${item.person}`,item.dueDate,true)),
          ...incoming.bills.filter(item=>item.reminder&&preferences.notifications).map(item=>scheduleReminder('bill',item.id,item.name,item.nextDue,true)),
        ]);
        if(scheduled.some(result=>!result))reminderWarning=' Some reminders need notification permission or have no future reminder time.';
      }catch(error){reminderWarning=error instanceof Error?` Reminder scheduling failed: ${error.message}`:' Some reminders could not be scheduled.'}
      toast(`Backup merged. Added ${added} new record${added===1?'':'s'}; existing records were kept.${reminderWarning}`);
    }catch(error){toast(error instanceof Error?error.message:'Could not restore this backup.')}
    finally{if(fileInput.current)fileInput.current.value=''}
  }
  const csvItems=transactions.slice().sort((a,b)=>b.date.localeCompare(a.date));
  return <FeatureFrame title="Backup & export" subtitle="Keep a portable copy of your records and export transactions for a spreadsheet.">
    <Panel title="Download your data">
      <p className="feature-note">Your backup is encrypted with a passphrase using AES-GCM. SpendWise cannot recover a lost passphrase. Local IndexedDB data is still not encrypted.</p>
      <InputField label="Backup passphrase (at least 12 characters)" type="password" autoComplete="new-password" value={backupPassphrase} onChange={event=>setBackupPassphrase(event.target.value)} minLength={12}/>
      <InputField label="Confirm backup passphrase" type="password" autoComplete="new-password" value={backupPassphraseConfirm} onChange={event=>setBackupPassphraseConfirm(event.target.value)} minLength={12}/>
      {backupPassphrase&&backupPassphraseConfirm&&backupPassphrase!==backupPassphraseConfirm&&<p role="alert" className="error">The passphrases do not match.</p>}
      <div className="feature-action-row"><button className="button" disabled={!ready||!accountId||backupPassphrase.length<12||backupPassphrase!==backupPassphraseConfirm} onClick={()=>void exportJson()}><HardDriveDownload size={16}/> Export full backup</button><button className="button outline" disabled={!transactions.length} onClick={()=>exportCSV(csvItems)}><Download size={16}/> Export transactions CSV</button></div>
    </Panel>
    <Panel title="Restore a backup">
      <p className="feature-note">Restore merges encrypted backups and never overwrites existing records with matching IDs. The backup must belong to this account and requires its passphrase.</p>
      <InputField label="Backup passphrase" type="password" autoComplete="current-password" value={restorePassphrase} onChange={event=>setRestorePassphrase(event.target.value)}/>
      <input ref={fileInput} className="visually-hidden" type="file" accept=".json,application/json" onChange={event=>void importJson(event.target.files?.[0])}/>
      <button className="button outline" disabled={!ready||!accountId} onClick={()=>fileInput.current?.click()}><Download size={16}/> Choose backup file</button>
    </Panel>
    <div className="backup-warning"><b>Protect your financial information.</b><span>Keep both the encrypted file and its passphrase private. If you lose the passphrase, the backup cannot be restored.</span></div>
  </FeatureFrame>;
}

export function transactionSearchIncludesNotes(transaction:Transaction,query:string){
  return transactionMatchesSearch(transaction,query);
}
