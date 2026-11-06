import {describe,it,expect} from 'vitest';
import {applyPendingChanges,OfflineState,PendingChange,queuePendingChange} from '../lib/offline-storage';
import {defaultPreferences} from '../lib/mock-data';
import type {Budget,Loan,RecurringBill,SharedExpense,Transaction} from '../types';

const original:Transaction={id:'transaction-1',type:'expense',amount:20,category:'Food',paymentMethod:'cash',date:'2026-11-01T10:00:00.000Z'};
const originalBudget:Budget={id:'budget-1',name:'Daily',amount:300,period:'daily'};
const state:OfflineState={userId:'user-1',transactions:[original],budgets:[originalBudget],loans:[],bills:[],sharedExpenses:[],preferences:defaultPreferences,pending:[]};

describe('offline change replay',()=>{
  it('applies offline creates and edits to the local snapshot',()=>{
    const updated={...original,amount:35};
    const newBudget={...originalBudget,id:'budget-2',name:'Food',category:'Food'};
    const changes:PendingChange[]=[
      {id:'change-1',userId:'user-1',type:'transaction.save',value:updated},
      {id:'change-2',userId:'user-1',type:'budget.save',value:newBudget},
    ];
    const result=applyPendingChanges(state,changes);
    expect(result.transactions).toEqual([updated]);
    expect(result.budgets).toEqual([newBudget,originalBudget]);
    expect(result.pending).toEqual([]);
  });

  it('applies deletes and keeps queued changes scoped to their account snapshot',()=>{
    const changes:PendingChange[]=[
      {id:'change-1',userId:'user-1',type:'transaction.delete',value:original.id},
      {id:'change-2',userId:'user-1',type:'budget.delete',value:originalBudget.id},
      {id:'change-3',userId:'user-1',type:'profile.save',value:{...defaultPreferences,dailyBudget:800}},
      {id:'change-4',userId:'other-user',type:'profile.save',value:{...defaultPreferences,dailyBudget:900}},
    ];
    const result=applyPendingChanges(state,changes);
    expect(result.userId).toBe('user-1');
    expect(result.transactions).toEqual([]);
    expect(result.budgets).toEqual([]);
    expect(result.preferences.dailyBudget).toBe(800);
  });

  it('immediately reflects queued offline deletes and restores them from the pending queue',()=>{
    const change:PendingChange={id:'change-delete',userId:'user-1',type:'transaction.delete',value:original.id};
    const queued=queuePendingChange(state,change);
    expect(queued.transactions).toEqual([]);
    expect(queued.pending).toEqual([change]);
    expect(applyPendingChanges(queued,queued.pending).transactions).toEqual([]);
  });

  it('immediately reflects queued offline edits and creates',()=>{
    const updated={...original,amount:45};
    const change:PendingChange={id:'change-save',userId:'user-1',type:'transaction.save',value:updated};
    const queued=queuePendingChange(state,change);
    expect(queued.transactions).toEqual([updated]);
    expect(queued.pending).toEqual([change]);
  });

  it('queues loans, recurring bills, and shared expenses in the local snapshot',()=>{
    const loan:Loan={id:'loan-1',direction:'repay',person:'Lender',principal:100,remaining:100,dueDate:'2026-12-01'};
    const bill:RecurringBill={id:'bill-1',name:'Internet',amount:50,category:'Bills',frequency:'monthly',nextDue:'2026-12-01',reminder:true};
    const shared:SharedExpense={id:'shared-1',title:'Dinner',total:30,paidBy:'Me',shares:[{name:'Alex',amount:10,settled:false}],createdAt:'2026-11-04T00:00:00Z'};
    const changes:PendingChange[]=[
      {id:'change-loan',userId:'user-1',type:'loan.save',value:loan},
      {id:'change-bill',userId:'user-1',type:'bill.save',value:bill},
      {id:'change-shared',userId:'user-1',type:'sharedExpense.save',value:shared},
    ];
    const queued=changes.reduce(queuePendingChange,state);
    expect(queued.loans).toEqual([loan]);
    expect(queued.bills).toEqual([bill]);
    expect(queued.sharedExpenses).toEqual([shared]);
    expect(queued.pending).toEqual(changes);
  });
});
