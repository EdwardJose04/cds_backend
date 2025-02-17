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
            const usuarioDecodificado = verificarToken(req);

            if (usuarioDecodificado.rol !== 'Administrador') {
                return res.status(403).json({
                    message: 'No tienes permiso para registrar herramientas'
                });
            }

            const {
                responsable,
                nombre_herramienta,
                cantidad_total,
                cantidad_prestamo = 0
            } = req.body;

            if (!responsable || !nombre_herramienta || !cantidad_total) {
                return res.status(400).json({ 
                    message: 'Los campos responsable, nombre_herramienta y cantidad_total son obligatorios' 
                });
            }

            // Validar que cantidad_prestamo no sea mayor que cantidad_total
            if (cantidad_prestamo > cantidad_total) {
                return res.status(400).json({
                    message: 'La cantidad en préstamo no puede ser mayor que la cantidad total'
                });
            }

            const cantidad_disponible = cantidad_total - cantidad_prestamo;

            const [result] = await promisePool.query(
                `INSERT INTO herramientas (
                    responsable, 
                    nombre_herramienta, 
                    cantidad_total,
                    cantidad_disponible,
                    cantidad_prestamo
                ) VALUES (?, ?, ?, ?, ?)`,
                [responsable, nombre_herramienta, cantidad_total, cantidad_disponible, cantidad_prestamo]
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
            verificarToken(req);

            const [herramientas] = await promisePool.query(
                `SELECT 
                    id,
                    responsable,
                    nombre_herramienta,
                    cantidad_total,
                    cantidad_disponible,
                    cantidad_prestamo,
                    fecha_ingreso
                FROM herramientas`
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
            verificarToken(req);

            const { id } = req.params;
            const [herramientas] = await promisePool.query(
                `SELECT 
                    id,
                    responsable,
                    nombre_herramienta,
                    cantidad_total,
                    cantidad_disponible,
                    cantidad_prestamo,
                    fecha_ingreso
                FROM herramientas 
                WHERE id = ?`,
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

    eliminarHerramienta: async (req, res) => {
        try {
            const usuarioDecodificado = verificarToken(req);

            if (usuarioDecodificado.rol !== 'Administrador') {
                return res.status(403).json({
                    message: 'No tienes permiso para eliminar herramientas'
                });
            }

            const { id } = req.params;

            // Verificar si la herramienta tiene cantidad en préstamo
            const [herramienta] = await promisePool.query(
                'SELECT cantidad_prestamo FROM herramientas WHERE id = ?',
                [id]
            );

            if (herramienta.length === 0) {
                return res.status(404).json({ message: 'Herramienta no encontrada' });
            }

            if (herramienta[0].cantidad_prestamo > 0) {
                return res.status(400).json({
                    message: 'No se puede eliminar una herramienta que tiene unidades en préstamo'
                });
            }

            const [result] = await promisePool.query(
                'DELETE FROM herramientas WHERE id = ?',
                [id]
            );

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