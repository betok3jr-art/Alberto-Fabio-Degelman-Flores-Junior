import { useState, useEffect } from "react";

export default function App() {
  const [theme, setTheme] = useState("light");

  // Aplicar tema salvo
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved) {
      setTheme(saved);
      document.documentElement.classList.toggle("dark", saved === "dark");
    }
  }, []);

  // Alternar tema
  function toggleTheme() {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
    localStorage.setItem("theme", newTheme);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="p-6 rounded-xl shadow-lg bg-white dark:bg-zinc-900">
        <h1 className="text-2xl font-bold mb-4">
          K3 Finance — Ambiente funcionando ✔️
        </h1>

        <p className="mb-4 opacity-80">
          Seu front-end carregou sem erros de JSX.
        </p>

        <button
          onClick={toggleTheme}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
        >
          Alternar Tema ({theme})
        </button>
      </div>
    </div>
  );
}
