export type PaymentMethod='cash'|'bkash'|'nagad'|'bank'|'other';
export interface Transaction {id:string;type:'income'|'expense';amount:number;category:string;subcategory?:string;description?:string;paymentMethod:PaymentMethod;date:string;notes?:string;loanId?:string;receiptPath?:string}
export interface Budget {id:string;name:string;amount:number;period:'daily'|'monthly';category?:string;month?:string;createdAt?:string}
export interface Loan {id:string;direction:'repay'|'lent';person:string;principal:number;remaining:number;dueDate:string;notes?:string}
export interface RecurringBill {id:string;name:string;amount:number;category:string;frequency:'weekly'|'monthly'|'yearly';nextDue:string;reminder:boolean;type?:'income'|'expense'}
export interface SharedExpense {id:string;title:string;total:number;paidBy:string;shares:{name:string;amount:number;settled:boolean}[];createdAt:string}
export interface UserPreferences {displayName:string;currency:'BDT';dailyBudget:number;theme:'light'|'dark'|'system';weekStart:'sunday'|'monday';paymentMethod:PaymentMethod;notifications:boolean;timezone:string}
