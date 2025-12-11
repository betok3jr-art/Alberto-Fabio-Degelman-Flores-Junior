import { Transaction, UserProfile, StorageSchema } from '../types';

const USERS_KEY = 'k3_users_list';
const CURRENT_USER_KEY = 'k3_current_user_id';

// Helper to generate IDs
export const generateId = () => Math.random().toString(36).substr(2, 9);

export const getStoredUsers = (): string[] => {
  const users = localStorage.getItem(USERS_KEY);
  return users ? JSON.parse(users) : [];
};

export const loadUserData = (username: string): StorageSchema | null => {
  const data = localStorage.getItem(`k3_data_${username}`);
  return data ? JSON.parse(data) : null;
};

export const saveUserData = (username: string, data: StorageSchema) => {
  localStorage.setItem(`k3_data_${username}`, JSON.stringify(data));
};

export const createUser = (name: string, pin: string): boolean => {
  const users = getStoredUsers();
  if (users.includes(name)) return false;

  const newUser: StorageSchema = {
    profile: {
      name,
      pin,
      theme: 'light',
      hasOnboarded: true
    },
    transactions: []
  };

  users.push(name);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  saveUserData(name, newUser);
  return true;
};

export const deleteTransaction = (username: string, id: string) => {
  const data = loadUserData(username);
  if (!data) return;
  data.transactions = data.transactions.filter(t => t.id !== id);
  saveUserData(username, data);
};

export const addTransactions = (username: string, newTransactions: Transaction[]) => {
  const data = loadUserData(username);
  if (!data) return;
  data.transactions = [...data.transactions, ...newTransactions];
  saveUserData(username, data);
};

export const updateTransaction = (username: string, updated: Transaction) => {
  const data = loadUserData(username);
  if (!data) return;
  data.transactions = data.transactions.map(t => t.id === updated.id ? updated : t);
  saveUserData(username, data);
};
