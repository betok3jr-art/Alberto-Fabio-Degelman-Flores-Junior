export type TransactionType = 'expense' | 'income';
export type TransactionStatus = 'pending' | 'paid' | 'overdue';

export interface Transaction {
  id: string;
  type: TransactionType;
  category: string;
  description: string;
  amount: number;
  date: string; // ISO string YYYY-MM-DD
  status: TransactionStatus;
  installmentCurrent?: number;
  installmentTotal?: number;
  isRecurring?: boolean;
}

export interface UserProfile {
  name: string;
  pin: string; // 4 digit pin
  theme: 'light' | 'dark';
  hasOnboarded: boolean;
}

export interface StorageSchema {
  transactions: Transaction[];
  profile: UserProfile;
}

export enum ViewState {
  LOGIN = 'LOGIN',
  REGISTER = 'REGISTER',
  DASHBOARD = 'DASHBOARD',
  LIST = 'LIST',
  REPORTS = 'REPORTS',
  AI_INSIGHTS = 'AI_INSIGHTS'
}

export const CATEGORIES = {
  expense: [
    '💳 Cartão', 
    '🍽️ Alimentação', 
    '🏠 Moradia', 
    '🚗 Transporte', 
    '💊 Saúde', 
    '🎉 Lazer', 
    '🎓 Educação', 
    '🛍️ Compras', 
    '🧾 Contas', 
    '📦 Outros'
  ],
  income: [
    '💰 Salário', 
    '🚀 Freelance', 
    '📈 Investimentos', 
    '🎁 Presente', 
    '💵 Outros'
  ]
};