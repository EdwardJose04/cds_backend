const { promisePool } = require('../config/database');
const jwt = require('jsonwebtoken');

const verificarToken = (req) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        throw new Error('Token no proporcionado');
    }

    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        throw new Error('Token inválido');
    }
};

const herramientasController = {
    crearHerramienta: async (req, res) => {
        try {
            // Verificar token
            const usuarioDecodificado = verificarToken(req);

            // Solo administradores pueden crear herramientas
            if (usuarioDecodificado.rol !== 'Administrador') {
                return res.status(403).json({
                    message: 'No tienes permiso para registrar herramientas'
                });
            }

            const {
                responsable,
                nombre_herramienta,
                cantidad,
                estado
            } = req.body;

            // Validaciones básicas
            if (!responsable || !nombre_herramienta || !cantidad) {
                return res.status(400).json({ message: 'Los campos responsable, nombre_herramienta y cantidad son obligatorios' });
            }

            // Insertar nueva herramienta
            const [result] = await promisePool.query(
                'INSERT INTO herramientas (responsable, nombre_herramienta, cantidad, estado) VALUES (?, ?, ?, ?)',
                [responsable, nombre_herramienta, cantidad, estado || 'En inventario']
            );

            res.status(201).json({
                message: 'Herramienta registrada exitosamente',
                herramientaId: result.insertId
            });

        } catch (error) {
            if (error.message === 'Token no proporcionado' || error.message === 'Token inválido') {
                return res.status(401).json({ message: error.message });
            }
            console.error('Error en registro de herramienta:', error);
            res.status(500).json({
                message: 'Error en el registro de herramienta',
                error: error.message
            });
        }
    },

    listarHerramientas: async (req, res) => {
        try {
            // Verificar token
            verificarToken(req);

            const [herramientas] = await promisePool.query(
                'SELECT * FROM herramientas'
            );
            res.status(200).json(herramientas);
        } catch (error) {
            if (error.message === 'Token no proporcionado' || error.message === 'Token inválido') {
                return res.status(401).json({ message: error.message });
            }
            console.error('Error al listar herramientas:', error);
            res.status(500).json({
                message: 'Error al listar herramientas',
                error: error.message
            });
        }
    },

    obtenerHerramienta: async (req, res) => {
        try {
            // Verificar token
            verificarToken(req);

            const { id } = req.params;
            const [herramientas] = await promisePool.query(
                'SELECT * FROM herramientas WHERE id = ?',
                [id]
            );

            if (herramientas.length === 0) {
                return res.status(404).json({ message: 'Herramienta no encontrada' });
            }

            res.status(200).json(herramientas[0]);
        } catch (error) {
            if (error.message === 'Token no proporcionado' || error.message === 'Token inválido') {
                return res.status(401).json({ message: error.message });
            }
            console.error('Error al obtener herramienta:', error);
            res.status(500).json({
                message: 'Error al obtener herramienta',
                error: error.message
            });
        }
    },

    actualizarHerramienta: async (req, res) => {
        try {
            // Verificar token
            const usuarioDecodificado = verificarToken(req);

            // Solo administradores pueden actualizar herramientas
            if (usuarioDecodificado.rol !== 'Administrador') {
                return res.status(403).json({
                    message: 'No tienes permiso para actualizar herramientas'
                });
            }

            const { id } = req.params;
            const {
                responsable,
                nombre_herramienta,
                cantidad,
                estado
            } = req.body;

            // Validaciones básicas
            if (!responsable || !nombre_herramienta || !cantidad) {
                return res.status(400).json({ message: 'Los campos responsable, nombre_herramienta y cantidad son obligatorios' });
            }

            const [result] = await promisePool.query(
                'UPDATE herramientas SET responsable = ?, nombre_herramienta = ?, cantidad = ?, estado = ? WHERE id = ?',
                [responsable, nombre_herramienta, cantidad, estado || 'En inventario', id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'Herramienta no encontrada' });
            }

            res.status(200).json({
                message: 'Herramienta actualizada exitosamente',
                herramienta: { id, responsable, nombre_herramienta, cantidad, estado }
            });

        } catch (error) {
            if (error.message === 'Token no proporcionado' || error.message === 'Token inválido') {
                return res.status(401).json({ message: error.message });
            }
            console.error('Error en actualización de herramienta:', error);
            res.status(500).json({
                message: 'Error en la actualización de herramienta',
                error: error.message
            });
        }
    },

    eliminarHerramienta: async (req, res) => {
        try {
            // Verificar token
            const usuarioDecodificado = verificarToken(req);

            // Solo administradores pueden eliminar herramientas
            if (usuarioDecodificado.rol !== 'Administrador') {
                return res.status(403).json({
                    message: 'No tienes permiso para eliminar herramientas'
                });
            }

            const { id } = req.params;

            const [result] = await promisePool.query(
                'DELETE FROM herramientas WHERE id = ?',
                [id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'Herramienta no encontrada' });
            }

            res.status(200).json({
                message: 'Herramienta eliminada exitosamente'
            });

        } catch (error) {
            if (error.message === 'Token no proporcionado' || error.message === 'Token inválido') {
                return res.status(401).json({ message: error.message });
            }
            console.error('Error al eliminar herramienta:', error);
            res.status(500).json({
                message: 'Error al eliminar herramienta',
                error: error.message
            });
        }
    }
};

module.exports = herramientasController;