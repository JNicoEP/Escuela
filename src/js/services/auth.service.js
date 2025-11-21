import { supabase } from '../config/supabaseClient.js';

export const AuthService = {
    
    // 1. Login (Solo Auth)
    async signIn(email, password) {
        return await supabase.auth.signInWithPassword({ email, password });
    },

    // 2. Logout
    async signOut() {
        return await supabase.auth.signOut();
    },

    // 3. Obtener datos del usuario para saber a dónde redirigir
    // (Extraído de tu función handleRedirection original)
    async getUserDataForRedirection(userId) {
        const { data, error } = await supabase
            .from('usuarios')
            .select(`
                rol (nombre_rol),
                docentes (estado) 
            `)
            .eq('id_usuario', userId)
            .single();
        
        if (error) throw error;
        return data;
    },

    // 4. Registro completo (Auth + Tablas)
    // (Tu función registrarUsuario adaptada a servicio)
    async registerUserFull(email, password, { nombre, apellido, dni, roleName }) {
        // A. Crear Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email, password
        });

        if (authError) throw authError;

        // B. Si se creó el usuario, crear perfil (Tu lógica original)
        if (authData.user) {
            return await this._createFullUserProfile(
                authData.user.id, nombre, apellido, dni, email, roleName
            );
        }
        
        return { success: false, error: new Error("No se pudo crear el usuario en Auth") };
    },

    // (Tu función createFullUserProfile movida aquí tal cual)
    async _createFullUserProfile(userId, nombre, apellido, dni, email, roleName) {
        try {
            // Buscar Rol
            const { data: rolData, error: rolError } = await supabase
                .from('rol').select('id_rol').eq('nombre_rol', roleName).single();

            if (rolError) throw new Error(`Error buscando rol: ${rolError.message}`);
            if (!rolData) throw new Error(`Rol "${roleName}" no encontrado.`);

            // Insertar Usuario
            const { error: userError } = await supabase
                .from('usuarios')
                .insert({
                    id_usuario: userId, nombre, apellido, dni, email, id_rol: rolData.id_rol
                });

            if (userError) throw new Error(`Error creando usuario: ${userError.message}`);

            // Insertar Específico
            let estadoFinal = 'aprobado'; 
            if (roleName === 'alumno') {
                const { error: err } = await supabase.from('alumnos')
                    .insert({ id_alumno: userId, estatus_inscripcion: 'activo' });
                if (err) throw new Error(`Error creando alumno: ${err.message}`);

            } else if (roleName === 'docente') {
                estadoFinal = 'pendiente'; 
                const { error: err } = await supabase.from('docentes')
                    .insert({ id_docente: userId, estado: 'pendiente' });
                if (err) throw new Error(`Error creando docente: ${err.message}`);
            }

            return { success: true, estado: estadoFinal, requiresConfirmation: false }; // Ajustado retorno

        } catch (error) {
            return { success: false, error: error };
        }
    }
};