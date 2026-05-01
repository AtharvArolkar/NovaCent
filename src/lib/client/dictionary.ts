import { appConfig } from "@/lib/app-config";

export type Language = "en" | "es";

export const languages: Record<Language, string> = {
  en: "English",
  es: "Espanol"
};

export const dictionary = {
  en: {
    appName: appConfig.name,
    navigation: "Primary navigation",
    dashboard: "Dashboard",
    expenses: "Expenses",
    budgets: "Budgets",
    parties: "Parties",
    importReview: "Import review",
    reports: "Reports",
    settings: "Settings",
    account: "Account",
    theme: "Theme",
    language: "Language",
    light: "Light",
    dark: "Dark",
    online: "Online",
    offline: "Offline",
    offlineMessage: "You are offline. Changes are saved locally and can sync when service APIs are connected.",
    addExpense: "Add expense",
    export: "Export",
    search: "Search",
    category: "Category",
    amount: "Amount",
    date: "Date",
    status: "Status",
    merchant: "Merchant",
    owner: "Owner",
    progress: "Progress",
    totalSpend: "Total spend",
    remainingBudget: "Remaining budget",
    monthlyRunway: "Monthly runway",
    pendingImports: "Pending imports",
    save: "Save",
    syncNow: "Sync now",
    logout: "Log out",
    hello: "Hello",
    user: "User"
  },
  es: {
    appName: appConfig.name,
    navigation: "Navegacion principal",
    dashboard: "Panel",
    expenses: "Gastos",
    budgets: "Presupuestos",
    parties: "Grupos",
    importReview: "Revision de importacion",
    reports: "Informes",
    settings: "Ajustes",
    account: "Cuenta",
    theme: "Tema",
    language: "Idioma",
    light: "Claro",
    dark: "Oscuro",
    online: "En linea",
    offline: "Sin conexion",
    offlineMessage: "Estas sin conexion. Los cambios se guardan localmente y se pueden sincronizar cuando las APIs esten conectadas.",
    addExpense: "Agregar gasto",
    export: "Exportar",
    search: "Buscar",
    category: "Categoria",
    amount: "Importe",
    date: "Fecha",
    status: "Estado",
    merchant: "Comercio",
    owner: "Responsable",
    progress: "Progreso",
    totalSpend: "Gasto total",
    remainingBudget: "Presupuesto restante",
    monthlyRunway: "Margen mensual",
    pendingImports: "Importaciones pendientes",
    save: "Guardar",
    syncNow: "Sincronizar",
    logout: "Cerrar sesion",
    hello: "Hola",
    user: "Usuario"
  }
} satisfies Record<Language, Record<string, string>>;

export type DictionaryKey = keyof typeof dictionary.en;
