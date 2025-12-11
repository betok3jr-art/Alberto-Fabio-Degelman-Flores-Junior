import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, ChevronLeft, ChevronRight, BarChart3, List, 
  Settings, LogOut, Trash2, CheckCircle, 
  Sparkles, Download, Moon, FileText, Calendar, Repeat, X, UploadCloud, FileUp, Check
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Transaction, TransactionType, ViewState, CATEGORIES, UserProfile, TransactionStatus } from './types';
import * as Storage from './services/storageService';
import * as Gemini from './services/geminiService';
import * as PDFService from './services/pdfService';

// C6 Style Palette: Carbon, Gold, Silver
const COLORS = ['#FFD700', '#242424', '#71717a', '#a1a1aa', '#d4d4d8', '#f4f4f5', '#000000'];

export default function App() {
  // --- Global State ---
  const [view, setView] = useState<ViewState>(ViewState.LOGIN);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  // --- UI State ---
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Transaction | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiInsight, setAiInsight] = useState<string>('');
  
  // --- Import State ---
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState<Partial<Transaction>[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Form State ---
  const [formType, setFormType] = useState<TransactionType>('expense');
  const [formDesc, setFormDesc] = useState('');
  const [formVal, setFormVal] = useState('');
  const [formCat, setFormCat] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formInstallments, setFormInstallments] = useState(1);
  const [formIsFixed, setFormIsFixed] = useState(false);
  const [formFrequency, setFormFrequency] = useState<'monthly' | 'weekly' | 'yearly'>('monthly');

  // --- Auth State ---
  const [loginName, setLoginName] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [registerMode, setRegisterMode] = useState(false);
  const [authError, setAuthError] = useState('');

  // --- Helpers ---
  const updateMetaThemeColor = (isDark: boolean) => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      // Dark mode: Matches header/bg-black | Light mode: Matches bg-[#F2F2F2] or header
      // We keep header color (zinc-900) for continuity or background color
      meta.setAttribute('content', isDark ? '#000000' : '#18181b'); 
    }
  };

  // --- Initialization ---
  useEffect(() => {
    const users = Storage.getStoredUsers();
    if (users.length === 0) {
      setRegisterMode(true);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      const data = Storage.loadUserData(currentUser);
      if (data) {
        setTransactions(data.transactions);
        setUserProfile(data.profile);
        if (data.profile.theme === 'dark') {
          document.documentElement.classList.add('dark');
          updateMetaThemeColor(true);
        } else {
          document.documentElement.classList.remove('dark');
          updateMetaThemeColor(false);
        }
      }
    } else {
      // Login screen defaults
      updateMetaThemeColor(true);
    }
  }, [currentUser]);

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const getMonthLabel = (date: Date) => {
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const currentMonthTransactions = useMemo(() => {
    return transactions.filter(t => {
      const tDate = new Date(t.date + 'T00:00:00');
      return tDate.getMonth() === currentDate.getMonth() && 
             tDate.getFullYear() === currentDate.getFullYear();
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, currentDate]);

  const summary = useMemo(() => {
    const income = currentMonthTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expense = currentMonthTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    return { income, expense, balance: income - expense };
  }, [currentMonthTransactions]);

  // --- Actions ---

  const handleLogin = () => {
    setAuthError('');
    if (!loginName || !loginPin) return;

    const data = Storage.loadUserData(loginName);
    if (data && data.profile.pin === loginPin) {
      setCurrentUser(loginName);
      setView(ViewState.LIST);
    } else {
      setAuthError('Usuário ou PIN incorretos');
    }
  };

  const handleRegister = () => {
    setAuthError('');
    if (!loginName || loginPin.length !== 4) {
      setAuthError('Preencha um nome e PIN de 4 dígitos');
      return;
    }
    const success = Storage.createUser(loginName, loginPin);
    if (success) {
      setCurrentUser(loginName);
      setView(ViewState.LIST);
    } else {
      setAuthError('Usuário já existe');
    }
  };

  const logout = () => {
    setCurrentUser(null);
    setTransactions([]);
    setAiInsight('');
    setLoginName('');
    setLoginPin('');
    setView(ViewState.LOGIN);
    document.documentElement.classList.remove('dark');
    updateMetaThemeColor(true); // Login screen is dark
  };

  const toggleTheme = () => {
    if (!currentUser || !userProfile) return;
    const newTheme = userProfile.theme === 'light' ? 'dark' : 'light';
    const newData = {
      transactions,
      profile: { ...userProfile, theme: newTheme }
    };
    Storage.saveUserData(currentUser, newData);
    setUserProfile(newData.profile);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
      updateMetaThemeColor(true);
    } else {
      document.documentElement.classList.remove('dark');
      updateMetaThemeColor(false);
    }
  };

  const deleteTrans = (id: string) => {
    if (!currentUser) return;
    Storage.deleteTransaction(currentUser, id);
    setTransactions(prev => prev.filter(t => t.id !== id));
    setEditItem(null);
    setShowForm(false);
  };

  const togglePaid = (t: Transaction) => {
    if (!currentUser) return;
    const newStatus: TransactionStatus = t.status === 'paid' ? 'pending' : 'paid';
    const updated = { ...t, status: newStatus };
    Storage.updateTransaction(currentUser, updated);
    setTransactions(prev => prev.map(tr => tr.id === t.id ? updated : tr));
  };

  // --- Export Actions ---

  const exportCSV = () => {
    const headers = "Data,Descrição,Categoria,Tipo,Valor,Status\n";
    const rows = currentMonthTransactions.map(t => 
      `${t.date},"${t.description}","${t.category}",${t.type},${t.amount},${t.status}`
    ).join("\n");
    const csvContent = "data:text/csv;charset=utf-8," + headers + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `k3_finance_${currentUser}_${currentDate.getMonth()+1}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(36, 36, 36); // Carbon
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 215, 0); // Gold
    doc.setFontSize(22);
    doc.text("K3 Finance", 14, 25);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.text(`Relatório Mensal - ${getMonthLabel(currentDate)}`, 14, 35);

    // Summary
    doc.setTextColor(0, 0, 0);
    doc.text(`Receitas: ${formatMoney(summary.income)}`, 14, 55);
    doc.text(`Despesas: ${formatMoney(summary.expense)}`, 14, 62);
    doc.text(`Saldo: ${formatMoney(summary.balance)}`, 14, 69);

    // Table
    const tableData = currentMonthTransactions.map(t => [
      new Date(t.date).toLocaleDateString('pt-BR'),
      t.description,
      t.category,
      t.type === 'income' ? 'Receita' : 'Despesa',
      formatMoney(t.amount),
      t.status === 'paid' ? 'Pago' : 'Aberto'
    ]);

    autoTable(doc, {
      startY: 80,
      head: [['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [36, 36, 36], textColor: [255, 215, 0] },
      alternateRowStyles: { fillColor: [242, 242, 242] }
    });

    doc.save(`relatorio_k3_${currentDate.getMonth()+1}.pdf`);
  };

  // --- Import Actions ---

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoadingAI(true);
    setShowImportModal(true);

    try {
      let textContent = '';

      if (file.type === 'application/pdf') {
        textContent = await PDFService.extractTextFromPDF(file);
      } else {
        // Assume text/csv
        textContent = await file.text();
      }

      // Send to Gemini
      const extractedData = await Gemini.parseDocumentToTransactions(textContent);
      setImportPreview(extractedData);
      
    } catch (error) {
      alert("Erro ao ler arquivo: " + error);
      setShowImportModal(false);
    } finally {
      setLoadingAI(false);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmImport = () => {
    if (!currentUser) return;
    
    // Convert preview to actual transactions and filter duplicates
    const newTransactions: Transaction[] = [];
    
    importPreview.forEach(item => {
      // Basic duplicate detection
      const isDuplicate = transactions.some(t => 
        t.date === item.date && 
        t.amount === item.amount && 
        t.description === item.description
      );

      if (!isDuplicate && item.amount && item.date && item.description && item.type) {
         newTransactions.push({
           id: Storage.generateId(),
           type: item.type as TransactionType,
           description: item.description,
           amount: item.amount || 0,
           category: item.category || '📦 Outros',
           date: item.date,
           status: 'paid', // Imported usually means processed/banked
           isRecurring: false
         });
      }
    });

    Storage.addTransactions(currentUser, newTransactions);
    setTransactions(prev => [...prev, ...newTransactions]);
    setShowImportModal(false);
    setImportPreview([]);
    // Switch to list view to see results
    setView(ViewState.LIST);
    // Maybe update current date to match import? For now keep current.
  };

  // --- CRUD Actions ---

  const saveTransaction = () => {
    if (!currentUser) return;
    if (!formDesc || !formVal || !formDate) return;

    const amount = parseFloat(formVal.replace(',', '.'));
    const baseDate = new Date(formDate);
    const newTransactions: Transaction[] = [];

    if (editItem) {
      Storage.deleteTransaction(currentUser, editItem.id);
       newTransactions.push({
        ...editItem,
        description: formDesc,
        amount,
        category: formCat,
        date: formDate,
        type: formType,
      } as Transaction);
    } else {
      let count = 1; 
      if (!formIsFixed) {
        count = formInstallments; 
      } else {
        // Fixed logic
        if (formFrequency === 'monthly') count = 12;
        if (formFrequency === 'weekly') count = 12; 
        if (formFrequency === 'yearly') count = 2; 
      }
      
      for (let i = 0; i < count; i++) {
        const nextDate = new Date(baseDate);
        if (!formIsFixed) {
            nextDate.setMonth(baseDate.getMonth() + i);
        } else {
            if (formFrequency === 'monthly') nextDate.setMonth(baseDate.getMonth() + i);
            if (formFrequency === 'weekly') nextDate.setDate(baseDate.getDate() + (i * 7));
            if (formFrequency === 'yearly') nextDate.setFullYear(baseDate.getFullYear() + i);
        }
        
        const dateStr = nextDate.toISOString().split('T')[0];
        const descSuffix = (!formIsFixed && count > 1) ? ` (${i + 1}/${count})` : '';

        newTransactions.push({
          id: Storage.generateId(),
          type: formType,
          description: formDesc + descSuffix,
          amount: (!formIsFixed && count > 1) ? (amount / 1) : amount,
          category: formCat,
          date: dateStr,
          status: 'pending',
          isRecurring: formIsFixed,
          installmentCurrent: (!formIsFixed && count > 1) ? i + 1 : undefined,
          installmentTotal: (!formIsFixed && count > 1) ? count : undefined
        });
      }
    }

    if (editItem) {
         setTransactions(prev => prev.map(t => t.id === editItem.id ? newTransactions[0] : t));
         Storage.saveUserData(currentUser, { transactions: transactions.map(t => t.id === editItem.id ? newTransactions[0] : t), profile: userProfile! });
    } else {
        Storage.addTransactions(currentUser, newTransactions);
        setTransactions(prev => [...prev, ...newTransactions]);
    }

    closeForm();
  };

  const openForm = (t?: Transaction) => {
    if (t) {
      setEditItem(t);
      setFormType(t.type);
      setFormDesc(t.description.replace(/\s\(\d+\/\d+\)$/, '')); 
      setFormVal(t.amount.toString());
      setFormCat(t.category);
      setFormDate(t.date);
      setFormInstallments(1);
      setFormIsFixed(!!t.isRecurring);
      setFormFrequency('monthly'); // Default
    } else {
      setEditItem(null);
      setFormDesc('');
      setFormVal('');
      setFormCat(CATEGORIES.expense[0]);
      setFormDate(new Date().toISOString().split('T')[0]);
      setFormInstallments(1);
      setFormIsFixed(false);
      setFormFrequency('monthly');
    }
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditItem(null);
  };

  const runAnalysis = async () => {
    setLoadingAI(true);
    const result = await Gemini.analyzeFinances(currentMonthTransactions, getMonthLabel(currentDate));
    setAiInsight(result);
    setLoadingAI(false);
  };

  // --- Render Functions ---

  if (view === ViewState.LOGIN || view === ViewState.REGISTER) {
    return (
      <div className="min-h-screen bg-zinc-900 flex flex-col items-center justify-center p-6 text-white font-sans">
        <div className="w-20 h-20 bg-black rounded-3xl flex items-center justify-center mb-8 shadow-2xl border border-zinc-800">
          <span className="text-4xl font-bold text-[#FFD700]">K3</span>
        </div>
        <h1 className="text-2xl font-light mb-10 tracking-widest uppercase">K3 Finance</h1>
        
        <div className="w-full max-w-sm bg-zinc-800/50 backdrop-blur-xl p-8 rounded-3xl border border-zinc-700/50 shadow-xl">
          <h2 className="text-lg font-medium mb-6 text-center text-zinc-300">
            {registerMode ? 'Criar Acesso' : 'Bem-vindo'}
          </h2>
          
          <input 
            type="text" 
            placeholder="Seu Nome"
            value={loginName}
            onChange={e => setLoginName(e.target.value)}
            className="w-full mb-4 p-4 rounded-xl bg-zinc-900/50 border border-zinc-700 placeholder-zinc-500 text-white outline-none focus:border-[#FFD700] transition-colors"
          />
          
          <input 
            type="tel" 
            placeholder="PIN"
            maxLength={4}
            value={loginPin}
            onChange={e => setLoginPin(e.target.value.replace(/\D/g, ''))}
            className="w-full mb-8 p-4 rounded-xl bg-zinc-900/50 border border-zinc-700 placeholder-zinc-500 text-white text-center tracking-[1.5em] outline-none focus:border-[#FFD700] transition-colors"
          />
          
          {authError && <p className="text-red-400 text-xs mb-4 text-center">{authError}</p>}

          <button 
            onClick={registerMode ? handleRegister : handleLogin}
            className="w-full bg-[#FFD700] text-black font-bold py-4 rounded-xl hover:bg-yellow-400 transition-all shadow-[0_0_20px_rgba(255,215,0,0.2)]"
          >
            {registerMode ? 'INICIAR' : 'ENTRAR'}
          </button>

          <div className="mt-6 text-center">
            <button 
              onClick={() => { setRegisterMode(!registerMode); setAuthError(''); }}
              className="text-xs text-zinc-400 hover:text-[#FFD700] transition-colors uppercase tracking-wider"
            >
              {registerMode ? 'Já possuo conta' : 'Novo cadastro'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Main App Layout ---
  return (
    <div className="min-h-screen bg-[#F2F2F2] dark:bg-[#000000] text-zinc-900 dark:text-zinc-100 pb-28 transition-colors duration-300 font-sans">
      
      {/* C6 Style Header */}
      <header className="bg-zinc-900 text-white px-6 pt-8 pb-10 rounded-b-[2.5rem] shadow-2xl relative z-10">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 bg-black border border-zinc-700 rounded-xl flex items-center justify-center text-[#FFD700] font-bold shadow-lg">
              K3
            </div>
            <div>
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-semibold">Olá,</p>
              <h1 className="text-xl font-medium text-white tracking-wide">{userProfile?.name}</h1>
            </div>
          </div>
          <button onClick={logout} className="p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 text-zinc-400 hover:text-[#FFD700] transition-colors">
            <LogOut size={18} />
          </button>
        </div>

        {/* Month Navigation - Floating */}
        <div className="flex items-center justify-between bg-black/40 backdrop-blur-md p-1.5 rounded-2xl border border-white/5 mb-6">
          <button 
            onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}
            className="p-2.5 hover:bg-white/10 rounded-xl text-zinc-400 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="font-light text-sm capitalize text-white tracking-widest">{getMonthLabel(currentDate)}</span>
          <button 
            onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}
            className="p-2.5 hover:bg-white/10 rounded-xl text-zinc-400 transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Summary Cards - Minimalist */}
        {view === ViewState.LIST && (
           <div className="flex justify-between gap-4 mt-2">
             <div className="flex-1">
                <p className="text-[10px] uppercase text-zinc-500 font-bold tracking-wider mb-1">Receitas</p>
                <p className="text-sm font-medium text-[#FFD700]">{formatMoney(summary.income)}</p>
             </div>
             <div className="w-px bg-zinc-800"></div>
             <div className="flex-1 text-center">
                <p className="text-[10px] uppercase text-zinc-500 font-bold tracking-wider mb-1">Despesas</p>
                <p className="text-sm font-medium text-white">{formatMoney(summary.expense)}</p>
             </div>
             <div className="w-px bg-zinc-800"></div>
             <div className="flex-1 text-right">
                <p className="text-[10px] uppercase text-zinc-500 font-bold tracking-wider mb-1">Saldo</p>
                <p className="text-sm font-medium text-white">{formatMoney(summary.balance)}</p>
             </div>
           </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="px-5 -mt-6 relative z-20">
        
        {view === ViewState.LIST && (
          <div className="space-y-3">
             {currentMonthTransactions.length === 0 ? (
               <div className="text-center py-20 text-zinc-400 bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-100 dark:border-zinc-800">
                 <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-300">
                    <List size={24} />
                 </div>
                 <p className="text-sm font-light">Nenhum lançamento este mês.</p>
               </div>
             ) : (
               currentMonthTransactions.map(t => (
                 <div key={t.id} onClick={() => openForm(t)} className="group bg-white dark:bg-[#18181b] p-5 rounded-3xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] dark:shadow-none dark:border dark:border-zinc-800 flex justify-between items-center cursor-pointer active:scale-[0.98] transition-all">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-inner ${t.type === 'income' ? 'bg-[#f0fdf4] dark:bg-green-900/20' : 'bg-[#fff1f2] dark:bg-red-900/20'}`}>
                        {t.category.split(' ')[0]} 
                      </div>
                      <div>
                        <p className="font-medium text-sm text-zinc-800 dark:text-zinc-200">{t.description}</p>
                        <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider mt-0.5">{t.category.split(' ').slice(1).join(' ')} • {new Date(t.date).toLocaleDateString('pt-BR', {day: '2-digit'})}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`text-sm font-semibold ${t.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
                        {t.type === 'expense' ? '- ' : '+ '}{formatMoney(t.amount)}
                      </span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); togglePaid(t); }}
                        className={`text-[10px] px-3 py-1 rounded-full font-semibold uppercase tracking-wide transition-colors ${
                          t.status === 'paid' 
                          ? 'bg-zinc-900 text-[#FFD700] dark:bg-[#FFD700] dark:text-black' 
                          : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800'
                        }`}
                      >
                        {t.status === 'paid' ? 'Pago' : 'Aberto'}
                      </button>
                    </div>
                 </div>
               ))
             )}
          </div>
        )}

        {view === ViewState.DASHBOARD && (
          <div className="space-y-6 pt-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400 px-2">Análise de Gastos</h2>
            <div className="h-72 bg-white dark:bg-[#18181b] rounded-[2rem] shadow-sm p-6 flex flex-col items-center justify-center border border-zinc-100 dark:border-zinc-800">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={Object.entries(
                      currentMonthTransactions
                        .filter(t => t.type === 'expense')
                        .reduce((acc, t) => {
                          acc[t.category] = (acc[t.category] || 0) + t.amount;
                          return acc;
                        }, {} as Record<string, number>)
                    ).map(([name, value]) => ({ name, value }))}
                    innerRadius={70}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {COLORS.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => formatMoney(Number(value))} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              {Object.entries(
                currentMonthTransactions
                  .filter(t => t.type === 'expense')
                  .reduce((acc, t) => {
                    acc[t.category] = (acc[t.category] || 0) + t.amount;
                    return acc;
                  }, {} as Record<string, number>)
              ).sort((a: [string, number], b: [string, number]) => b[1] - a[1]).map(([name, value], idx) => (
                <div key={name} className="bg-white dark:bg-[#18181b] p-4 rounded-2xl flex items-center justify-between border border-zinc-50 dark:border-zinc-800">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-8 rounded-full" style={{backgroundColor: COLORS[idx % COLORS.length]}}></div>
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{name}</span>
                  </div>
                  <span className="font-bold text-sm">{formatMoney(value as number)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === ViewState.AI_INSIGHTS && (
          <div className="space-y-6 pt-4">
             <div className="bg-zinc-900 rounded-[2rem] p-8 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#FFD700] blur-[80px] opacity-20"></div>
                <div className="flex items-center gap-3 mb-6 relative z-10">
                  <div className="p-2 bg-white/10 rounded-xl">
                    <Sparkles className="text-[#FFD700]" size={20} />
                  </div>
                  <h2 className="font-bold text-lg tracking-wide">K3 Intelligence</h2>
                </div>
                
                {aiInsight ? (
                  <div className="bg-white/5 backdrop-blur-md p-6 rounded-2xl mb-6 border border-white/10 animate-fade-in">
                    <p className="text-sm leading-relaxed text-zinc-300 whitespace-pre-line font-light">{aiInsight}</p>
                  </div>
                ) : (
                  <p className="text-zinc-400 text-sm mb-8 font-light leading-relaxed">
                    Nossa IA analisa seu comportamento financeiro e gera insights exclusivos para otimizar seus gastos.
                  </p>
                )}

                <button 
                  onClick={runAnalysis}
                  disabled={loadingAI}
                  className="w-full bg-[#FFD700] text-black font-bold py-4 rounded-xl shadow-lg hover:bg-yellow-400 transition disabled:opacity-50 uppercase tracking-wider text-xs"
                >
                  {loadingAI ? 'Processando...' : 'Gerar Resumo do Mês'}
                </button>
             </div>

             <div className="grid grid-cols-2 gap-4">
                <button onClick={exportPDF} className="bg-white dark:bg-[#18181b] p-6 rounded-[2rem] shadow-sm border border-zinc-100 dark:border-zinc-800 flex flex-col items-center justify-center gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition">
                   <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center">
                     <FileText size={20} />
                   </div>
                   <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Baixar PDF</span>
                </button>
                <button onClick={exportCSV} className="bg-white dark:bg-[#18181b] p-6 rounded-[2rem] shadow-sm border border-zinc-100 dark:border-zinc-800 flex flex-col items-center justify-center gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition">
                   <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-full flex items-center justify-center">
                     <Download size={20} />
                   </div>
                   <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Baixar CSV</span>
                </button>
             </div>
          </div>
        )}

        {view === ViewState.REPORTS && (
          <div className="space-y-4 pt-4">
             <div className="bg-white dark:bg-[#18181b] rounded-[2rem] p-6 shadow-sm border border-zinc-100 dark:border-zinc-800">
               <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-6">Preferências</h2>
               
               <div className="flex items-center justify-between py-4 border-b border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center gap-3 text-zinc-700 dark:text-zinc-300">
                    <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                      <Moon size={18} />
                    </div>
                    <span className="font-medium">Modo Escuro</span>
                  </div>
                  <button onClick={toggleTheme} className={`w-12 h-7 rounded-full p-1 transition-colors duration-300 ${userProfile?.theme === 'dark' ? 'bg-[#FFD700]' : 'bg-zinc-200'}`}>
                    <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300 ${userProfile?.theme === 'dark' ? 'translate-x-5' : ''}`}></div>
                  </button>
               </div>

                <div className="py-4 border-b border-zinc-100 dark:border-zinc-800">
                  <label htmlFor="import-file" className="cursor-pointer flex items-center justify-between w-full">
                     <div className="flex items-center gap-3 text-zinc-700 dark:text-zinc-300">
                        <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                           <UploadCloud size={18} />
                        </div>
                        <span className="font-medium">Importar Extrato (PDF/CSV)</span>
                     </div>
                     <span className="text-[#FFD700] bg-zinc-900 px-2 py-1 rounded text-xs font-bold">AI</span>
                  </label>
                  <input 
                    id="import-file" 
                    type="file" 
                    accept=".csv, .pdf"
                    ref={fileInputRef}
                    className="hidden" 
                    onChange={handleFileUpload}
                  />
               </div>

               <div className="flex items-center justify-between py-4 text-zinc-400">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                       <Settings size={18} />
                    </div>
                    <span className="font-medium">Versão 2.1 (Import AI)</span>
                  </div>
                  <span className="text-xs">Atualizado</span>
               </div>
             </div>
          </div>
        )}

      </main>

      {/* FAB - Floating Action Button - Minimalist C6 Style */}
      {view === ViewState.LIST && (
        <button 
          onClick={() => openForm()}
          className="fixed bottom-28 right-6 w-16 h-16 bg-[#FFD700] rounded-full flex items-center justify-center text-black shadow-2xl hover:bg-yellow-400 transition-all hover:scale-105 active:scale-95 z-40 border-4 border-[#F2F2F2] dark:border-[#000000]"
        >
          <Plus size={32} />
        </button>
      )}

      {/* Bottom Navigation - Glassmorphism */}
      <nav className="fixed bottom-6 left-6 right-6 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/20 dark:border-zinc-800/50 flex justify-around py-4 z-50">
        <button onClick={() => setView(ViewState.LIST)} className={`flex flex-col items-center gap-1 ${view === ViewState.LIST ? 'text-black dark:text-[#FFD700]' : 'text-zinc-400'}`}>
          <List size={20} strokeWidth={view === ViewState.LIST ? 2.5 : 2} />
        </button>
        <button onClick={() => setView(ViewState.DASHBOARD)} className={`flex flex-col items-center gap-1 ${view === ViewState.DASHBOARD ? 'text-black dark:text-[#FFD700]' : 'text-zinc-400'}`}>
          <BarChart3 size={20} strokeWidth={view === ViewState.DASHBOARD ? 2.5 : 2} />
        </button>
        <button onClick={() => setView(ViewState.AI_INSIGHTS)} className={`flex flex-col items-center gap-1 ${view === ViewState.AI_INSIGHTS ? 'text-black dark:text-[#FFD700]' : 'text-zinc-400'}`}>
          <Sparkles size={20} strokeWidth={view === ViewState.AI_INSIGHTS ? 2.5 : 2} />
        </button>
        <button onClick={() => setView(ViewState.REPORTS)} className={`flex flex-col items-center gap-1 ${view === ViewState.REPORTS ? 'text-black dark:text-[#FFD700]' : 'text-zinc-400'}`}>
          <Settings size={20} strokeWidth={view === ViewState.REPORTS ? 2.5 : 2} />
        </button>
      </nav>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white dark:bg-[#18181b] w-full max-w-lg rounded-[2rem] p-6 shadow-2xl border border-zinc-100 dark:border-zinc-800 max-h-[80vh] flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold dark:text-white flex items-center gap-2">
                  {loadingAI ? <Sparkles className="animate-pulse text-[#FFD700]" /> : <FileUp />}
                  {loadingAI ? 'Analisando Documento...' : 'Confirmar Importação'}
                </h3>
                {!loadingAI && (
                  <button onClick={() => setShowImportModal(false)} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full text-zinc-500">
                    <X size={18} />
                  </button>
                )}
              </div>

              {loadingAI ? (
                <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
                   <div className="w-12 h-12 border-4 border-zinc-200 border-t-[#FFD700] rounded-full animate-spin"></div>
                   <p className="text-zinc-500 text-sm">A IA está lendo seu extrato e categorizando os gastos...</p>
                </div>
              ) : (
                <>
                  <div className="overflow-y-auto flex-1 mb-4 space-y-2 pr-2">
                     <p className="text-sm text-zinc-500 mb-2">Encontramos {importPreview.length} transações:</p>
                     {importPreview.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl text-sm">
                           <div>
                              <p className="font-bold dark:text-white truncate max-w-[180px]">{item.description}</p>
                              <p className="text-xs text-zinc-400">{item.date} • {item.category}</p>
                           </div>
                           <span className={item.type === 'expense' ? 'text-red-500' : 'text-green-500 font-bold'}>
                              {item.type === 'expense' ? '-' : '+'}{formatMoney(item.amount || 0)}
                           </span>
                        </div>
                     ))}
                  </div>
                  <button 
                    onClick={confirmImport}
                    className="w-full bg-[#FFD700] text-black font-bold py-4 rounded-xl shadow-lg hover:bg-yellow-400 transition active:scale-95 uppercase tracking-wide flex items-center justify-center gap-2"
                  >
                    <CheckCircle size={20} />
                    Importar Tudo
                  </button>
                </>
              )}
           </div>
        </div>
      )}

      {/* Transaction Modal Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-end sm:items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#18181b] w-full max-w-md rounded-[2rem] p-6 shadow-2xl animate-slide-up sm:animate-none border border-zinc-100 dark:border-zinc-800">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold dark:text-white tracking-tight">
                {editItem ? 'Editar' : 'Novo Lançamento'}
              </h3>
              <button onClick={closeForm} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full text-zinc-500">
                <X size={18} />
              </button>
            </div>
            
            <div className="flex gap-2 mb-6 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl">
              <button 
                className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all ${formType === 'expense' ? 'bg-white dark:bg-zinc-800 text-red-600 shadow-sm' : 'text-zinc-400'}`}
                onClick={() => setFormType('expense')}
              >
                Despesa
              </button>
              <button 
                className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all ${formType === 'income' ? 'bg-white dark:bg-zinc-800 text-green-600 shadow-sm' : 'text-zinc-400'}`}
                onClick={() => setFormType('income')}
              >
                Receita
              </button>
            </div>

            <div className="space-y-5">
              <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider block mb-1">Valor</label>
                <div className="flex items-center">
                  <span className="text-2xl text-zinc-400 mr-2">R$</span>
                  <input 
                    type="number" 
                    value={formVal} 
                    onChange={e => setFormVal(e.target.value)} 
                    placeholder="0,00"
                    className="w-full text-3xl font-bold bg-transparent outline-none dark:text-white"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider block mb-2 ml-1">Descrição</label>
                <input 
                  value={formDesc} 
                  onChange={e => setFormDesc(e.target.value)} 
                  placeholder="Ex: Mercado"
                  className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 dark:text-white outline-none focus:border-[#FFD700] transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider block mb-2 ml-1">Categoria</label>
                   <select 
                     value={formCat} 
                     onChange={e => setFormCat(e.target.value)}
                     className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 dark:text-white outline-none appearance-none"
                   >
                     <option value="" disabled>Selecione</option>
                     {CATEGORIES[formType].map(c => <option key={c} value={c}>{c}</option>)}
                   </select>
                </div>
                <div>
                   <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider block mb-2 ml-1">Data</label>
                   <input 
                     type="date"
                     value={formDate} 
                     onChange={e => setFormDate(e.target.value)}
                     className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 dark:text-white outline-none"
                   />
                </div>
              </div>

              {!editItem && (
                <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                   <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Repeat size={18} className="text-zinc-400" />
                        <span className="text-sm font-medium dark:text-zinc-200">Lançamento Fixo</span>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={formIsFixed} 
                        onChange={e => {
                          setFormIsFixed(e.target.checked); 
                          setFormInstallments(1);
                        }}
                        className="w-5 h-5 accent-[#FFD700] rounded" 
                      />
                   </div>

                   {formIsFixed ? (
                      <div className="flex gap-2 animate-fade-in">
                        {['weekly', 'monthly', 'yearly'].map((freq) => (
                           <button
                             key={freq}
                             onClick={() => setFormFrequency(freq as 'monthly' | 'weekly' | 'yearly')}
                             className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                               formFrequency === freq 
                               ? 'bg-[#FFD700] text-black border-[#FFD700]' 
                               : 'bg-white dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700'
                             }`}
                           >
                             {freq === 'weekly' && 'Semanal'}
                             {freq === 'monthly' && 'Mensal'}
                             {freq === 'yearly' && 'Anual'}
                           </button>
                        ))}
                      </div>
                   ) : (
                     <div className="flex items-center gap-3 animate-fade-in">
                        <Calendar size={18} className="text-zinc-400" />
                        <span className="text-sm text-zinc-500">Parcelas:</span>
                        <input 
                          type="number" 
                          min="1" 
                          max="48" 
                          value={formInstallments}
                          onChange={e => setFormInstallments(parseInt(e.target.value))}
                          className="w-20 p-2 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-center font-bold outline-none focus:border-[#FFD700]"
                        />
                     </div>
                   )}
                </div>
              )}

              <div className="flex gap-3 mt-4">
                {editItem && (
                  <button onClick={() => deleteTrans(editItem.id)} className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-2xl hover:bg-red-100">
                    <Trash2 size={24} />
                  </button>
                )}
                <button onClick={saveTransaction} className="flex-1 p-4 bg-[#FFD700] text-black rounded-2xl font-bold shadow-lg hover:bg-yellow-400 transition transform active:scale-95 uppercase tracking-wide">
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Styles for animation */}
      <style>{`
        @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .animate-slide-up { animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes fade-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
      `}</style>
    </div>
  );
}