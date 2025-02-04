const bcrypt = require('bcryptjs');
const { promisePool } = require('../config/database');
const jwt = require('jsonwebtoken');

const verificarToken = (req) => {
    // Obtener el token del header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        throw new Error('Token no proporcionado');
    }

    try {
        // Verificar y decodificar el token
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        throw new Error('Token inválido');
    }
};

const usuariosController = {
    registrarUsuario: async (req, res) => {
        try {
            // Verificar token
            const usuarioDecodificado = verificarToken(req);
    
            // Verificar si el usuario tiene rol de Administrador
            if (usuarioDecodificado.rol !== 'Administrador') {
                return res.status(403).json({ 
                    message: 'No tienes permiso para registrar usuarios' 
                });
            }
    
            const { 
                numero_documento, 
                nombre_completo, 
                correo_electronico, 
                rol, 
                contraseña 
            } = req.body;
    
            // Validaciones básicas
            if (!numero_documento || !nombre_completo || !correo_electronico || !rol || !contraseña) {
                return res.status(400).json({ message: 'Todos los campos son obligatorios' });
            }
    
            // Verificar si el usuario ya existe
            const [existingUsers] = await promisePool.query(
                'SELECT * FROM usuarios WHERE numero_documento = ? OR correo_electronico = ?', 
                [numero_documento, correo_electronico]
            );
    
            if (existingUsers.length > 0) {
                return res.status(400).json({ 
                    message: 'El número de documento o correo electrónico ya están registrados' 
                });
            }
    
            // Hashear la contraseña
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(contraseña, salt);
    
            // Insertar nuevo usuario
            const [result] = await promisePool.query(
                'INSERT INTO usuarios (numero_documento, nombre_completo, correo_electronico, rol, contraseña) VALUES (?, ?, ?, ?, ?)',
                [numero_documento, nombre_completo, correo_electronico, rol, hashedPassword]
            );
    
            // Generar token JWT
            const token = jwt.sign(
                { 
                    id: result.insertId, 
                    rol: rol 
                },
                process.env.JWT_SECRET,
                { expiresIn: '1d' }
            );
    
            res.status(201).json({ 
                message: 'Usuario registrado exitosamente',
                userId: result.insertId,
                token 
            });
    
        } catch (error) {
            if (error.message === 'Token no proporcionado' || error.message === 'Token inválido') {
                return res.status(401).json({ message: error.message });
            }
            console.error('Error en registro de usuario:', error);
            res.status(500).json({ 
                message: 'Error en el registro de usuario', 
                error: error.message 
            });
        }
    },

    login: async (req, res) => {
        try {
            const { numero_documento, contraseña } = req.body;

            // Validaciones básicas
            if (!numero_documento || !contraseña) {
                return res.status(400).json({ message: 'Número de documento y contraseña son obligatorios' });
            }

            // Buscar usuario por número de documento
            const [usuarios] = await promisePool.query(
                'SELECT * FROM usuarios WHERE numero_documento = ?', 
                [numero_documento]
            );

            // Verificar si el usuario existe
            if (usuarios.length === 0) {
                return res.status(400).json({ 
                    message: 'Credenciales inválidas' 
                });
            }

            // Obtener el primer usuario (debería ser único)
            const usuario = usuarios[0];

            // Verificar contraseña
            const esContraseñaValida = await bcrypt.compare(contraseña, usuario.contraseña);

            if (!esContraseñaValida) {
                return res.status(400).json({ 
                    message: 'Credenciales inválidas' 
                });
            }

            // Generar token JWT
            const token = jwt.sign(
                { 
                    id: usuario.id, 
                    rol: usuario.rol 
                },
                process.env.JWT_SECRET,
                { expiresIn: '1d' }
            );

            // Respuesta exitosa (excluyendo la contraseña)
            const { contraseña: _, ...usuarioSinContraseña } = usuario;

            res.status(200).json({ 
                message: 'Inicio de sesión exitoso',
                usuario: usuarioSinContraseña,
                token 
            });

        } catch (error) {
            console.error('Error en inicio de sesión:', error);
            res.status(500).json({ 
                message: 'Error en el inicio de sesión', 
                error: error.message 
            });
        }
    },

    listarUsuarios: async (req, res) => {
        try {
            // Verificar token
            verificarToken(req);

            const [usuarios] = await promisePool.query(
                'SELECT id, numero_documento, nombre_completo, correo_electronico, rol FROM usuarios'
            );
            res.status(200).json(usuarios);
        } catch (error) {
            if (error.message === 'Token no proporcionado' || error.message === 'Token inválido') {
                return res.status(401).json({ message: error.message });
            }
            console.error('Error al listar usuarios:', error);
            res.status(500).json({ 
                message: 'Error al listar usuarios', 
                error: error.message 
            });
        }
    },

    obtenerUsuario: async (req, res) => {
        try {
            // Verificar token
            verificarToken(req);

            const { id } = req.params;
            const [usuarios] = await promisePool.query(
                'SELECT id, numero_documento, nombre_completo, correo_electronico, rol FROM usuarios WHERE id = ?',
                [id]
            );

            if (usuarios.length === 0) {
                return res.status(404).json({ message: 'Usuario no encontrado' });
            }

            res.status(200).json(usuarios[0]);
        } catch (error) {
            if (error.message === 'Token no proporcionado' || error.message === 'Token inválido') {
                return res.status(401).json({ message: error.message });
            }
            console.error('Error al obtener usuario:', error);
            res.status(500).json({ 
                message: 'Error al obtener usuario', 
                error: error.message 
            });
        }
    },

    actualizarUsuario: async (req, res) => {
        try {
            // Verificar token
            const usuarioDecodificado = verificarToken(req);

            const { id } = req.params;
            const { 
                numero_documento, 
                nombre_completo, 
                correo_electronico, 
                rol 
            } = req.body;

            // Validaciones básicas
            if (!numero_documento || !nombre_completo || !correo_electronico || !rol) {
                return res.status(400).json({ message: 'Todos los campos son obligatorios' });
            }

            // Opcional: Verificar si el usuario tiene permiso para actualizar
            // Puedes descomentar y ajustar según tus necesidades
             if (usuarioDecodificado.id !== parseInt(id) && usuarioDecodificado.rol !== 'Administrador') {
                 return res.status(403).json({ message: 'No tienes permiso para actualizar este usuario' });
             }

            // Actualizar usuario
            const [result] = await promisePool.query(
                'UPDATE usuarios SET numero_documento = ?, nombre_completo = ?, correo_electronico = ?, rol = ? WHERE id = ?',
                [numero_documento, nombre_completo, correo_electronico, rol, id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'Usuario no encontrado' });
            }

            res.status(200).json({ 
                message: 'Usuario actualizado exitosamente',
                usuario: { id, numero_documento, nombre_completo, correo_electronico, rol }
            });

        } catch (error) {
            if (error.message === 'Token no proporcionado' || error.message === 'Token inválido') {
                return res.status(401).json({ message: error.message });
            }
            console.error('Error en actualización de usuario:', error);
            res.status(500).json({ 
                message: 'Error en la actualización de usuario', 
                error: error.message 
            });
        }
    },

    eliminarUsuario: async (req, res) => {
        try {
            // Verificar token
            const usuarioDecodificado = verificarToken(req);

            const { id } = req.params;

            // Opcional: Verificar si el usuario tiene permiso para eliminar
            if (usuarioDecodificado.rol !== 'Administrador') {
                return res.status(403).json({ message: 'No tienes permiso para eliminar usuarios' });
            }

            const [result] = await promisePool.query(
                'DELETE FROM usuarios WHERE id = ?',
                [id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'Usuario no encontrado' });
            }

            res.status(200).json({ 
                message: 'Usuario eliminado exitosamente'
            });

        } catch (error) {
            if (error.message === 'Token no proporcionado' || error.message === 'Token inválido') {
                return res.status(401).json({ message: error.message });
            }
            console.error('Error al eliminar usuario:', error);
            res.status(500).json({ 
                message: 'Error al eliminar usuario', 
                error: error.message 
            });
        }
    }
};

module.exports = usuariosController;