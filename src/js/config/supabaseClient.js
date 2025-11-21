// 1. Importar el cliente desde el paquete NPM
import { createClient } from '@supabase/supabase-js';

// 2. Leer las variables de entorno de Vite (desde .env)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 3. Exportar el cliente para que otros módulos puedan importarlo
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
