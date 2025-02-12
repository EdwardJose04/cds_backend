const { promisePool } = require('../config/database');
const jwt = require('jsonwebtoken');

const verificarToken = (req) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) throw new Error('Token no proporcionado');
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        throw new Error('Token inválido');
    }
};

const reportesController = {
    crearReporteSalida: async (req, res) => {
        try {
            verificarToken(req);
            const { producto_id, cantidad_retirada, responsable, motivo } = req.body;

            // Validaciones
            if (!producto_id || !cantidad_retirada || !responsable || !motivo) {
                return res.status(400).json({ message: 'Todos los campos son obligatorios' });
            }

            // Verificar existencia y disponibilidad del producto
            const [producto] = await promisePool.query(
                'SELECT * FROM productos WHERE id = ?',
                [producto_id]
            );

            if (producto.length === 0) {
                return res.status(404).json({ message: 'Producto no encontrado' });
            }

            if (producto[0].cantidad < cantidad_retirada) {
                return res.status(400).json({ message: 'No hay suficiente stock disponible' });
            }

            // Iniciar transacción
            const connection = await promisePool.getConnection();
            await connection.beginTransaction();

            try {
                // Registrar la salida
                const [resultSalida] = await connection.query(
                    'INSERT INTO reportes_salidas (producto_id, cantidad_retirada, responsable, motivo) VALUES (?, ?, ?, ?)',
                    [producto_id, cantidad_retirada, responsable, motivo]
                );

                // Actualizar el stock del producto
                await connection.query(
                    'UPDATE productos SET cantidad = cantidad - ? WHERE id = ?',
                    [cantidad_retirada, producto_id]
                );

                await connection.commit();

                // Obtener el reporte creado con los detalles del producto
                const [nuevoReporte] = await promisePool.query(`
                    SELECT rs.*, p.nombre as nombre_producto 
                    FROM reportes_salidas rs 
                    JOIN productos p ON rs.producto_id = p.id 
                    WHERE rs.id = ?`,
                    [resultSalida.insertId]
                );

                res.status(201).json({
                    message: 'Reporte de salida registrado exitosamente',
                    reporte: nuevoReporte[0]
                });

            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }

        } catch (error) {
            console.error('Error al crear reporte de salida:', error);
            res.status(500).json({
                message: 'Error al crear reporte de salida',
                error: error.message
            });
        }
    },

    listarReportesSalidas: async (req, res) => {
        try {
            verificarToken(req);

            const [reportes] = await promisePool.query(`
                SELECT rs.*, p.nombre as nombre_producto 
                FROM reportes_salidas rs 
                JOIN productos p ON rs.producto_id = p.id 
                ORDER BY rs.fecha_salida DESC
            `);

            res.status(200).json(reportes);
        } catch (error) {
            console.error('Error al listar reportes:', error);
            res.status(500).json({
                message: 'Error al listar reportes de salidas',
                error: error.message
            });
        }
    },

    obtenerReporteSalida: async (req, res) => {
        try {
            verificarToken(req);
            const { id } = req.params;

            const [reporte] = await promisePool.query(`
                SELECT rs.*, p.nombre as nombre_producto 
                FROM reportes_salidas rs 
                JOIN productos p ON rs.producto_id = p.id 
                WHERE rs.id = ?
            `, [id]);

            if (reporte.length === 0) {
                return res.status(404).json({ message: 'Reporte no encontrado' });
            }

            res.status(200).json(reporte[0]);
        } catch (error) {
            console.error('Error al obtener reporte:', error);
            res.status(500).json({
                message: 'Error al obtener reporte de salida',
                error: error.message
            });
        }
    },

    obtenerReportesPorProducto: async (req, res) => {
        try {
            verificarToken(req);
            const { producto_id } = req.params;

            const [reportes] = await promisePool.query(`
                SELECT rs.*, p.nombre as nombre_producto 
                FROM reportes_salidas rs 
                JOIN productos p ON rs.producto_id = p.id 
                WHERE rs.producto_id = ?
                ORDER BY rs.fecha_salida DESC
            `, [producto_id]);

            res.status(200).json(reportes);
        } catch (error) {
            console.error('Error al obtener reportes por producto:', error);
            res.status(500).json({
                message: 'Error al obtener reportes por producto',
                error: error.message
            });
        }
    },

    obtenerEstadisticas: async (req, res) => {
        try {
            verificarToken(req);

            // Obtener estadísticas generales
            const [estadisticas] = await promisePool.query(`
                SELECT 
                    p.id,
                    p.nombre,
                    p.cantidad as stock_actual,
                    COUNT(rs.id) as total_salidas,
                    SUM(rs.cantidad_retirada) as total_retirado
                FROM productos p
                LEFT JOIN reportes_salidas rs ON p.id = rs.producto_id
                GROUP BY p.id, p.nombre, p.cantidad
                ORDER BY total_retirado DESC
            `);

            res.status(200).json(estadisticas);
        } catch (error) {
            console.error('Error al obtener estadísticas:', error);
            res.status(500).json({
                message: 'Error al obtener estadísticas',
                error: error.message
            });
        }
    }
};

module.exports = reportesController;