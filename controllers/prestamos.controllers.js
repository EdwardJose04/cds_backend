const { promisePool } = require("../config/database");
const jwt = require("jsonwebtoken");

const verificarToken = (req) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) throw new Error("Token no proporcionado");
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error("Token inválido");
  }
};

const prestamosController = {
  generarNumeroTicket: async (req, res) => {
    try {
      verificarToken(req);

      const [tickets] = await promisePool.query(`
        SELECT numero_ticket 
        FROM prestamos 
        WHERE DATE(fecha_prestamo) = CURDATE()
        ORDER BY id DESC
      `);

      const fechaActual = new Date()
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "");
      let numeroSecuencial = "0001";

      if (tickets.length > 0) {
        const ultimoNumero =
          Math.max(
            ...tickets.map((t) => parseInt(t.numero_ticket.split("-")[2]))
          ) + 1;
        numeroSecuencial = String(ultimoNumero).padStart(4, "0");
      }

      const nuevoTicket = `TICKET-${fechaActual}-${numeroSecuencial}`;

      const [ticketExistente] = await promisePool.query(
        "SELECT id FROM prestamos WHERE numero_ticket = ?",
        [nuevoTicket]
      );

      if (ticketExistente.length > 0) {
        throw new Error("Error de generación de ticket: número duplicado");
      }

      res.status(200).json({ numero_ticket: nuevoTicket });
    } catch (error) {
      console.error("Error al generar número de ticket:", error);
      res.status(500).json({
        message: "Error al generar número de ticket",
        error: error.message,
      });
    }
  },

  crearPrestamo: async (req, res) => {
    const connection = await promisePool.getConnection();
    try {
      await connection.beginTransaction();

      const usuarioDecodificado = verificarToken(req);

      if (usuarioDecodificado.rol !== "Administrador") {
        throw new Error("No autorizado");
      }

      const {
        herramienta_id,
        cantidad,
        responsable,
        lugar_uso,
        numero_ticket,
      } = req.body;

      if (!numero_ticket?.trim())
        throw new Error("Número de ticket es requerido");
      if (!herramienta_id) throw new Error("ID de herramienta es requerido");
      if (!cantidad) throw new Error("Cantidad es requerida");
      if (!responsable?.trim()) throw new Error("Responsable es requerido");
      if (!lugar_uso?.trim()) throw new Error("Lugar de uso es requerido");
      if (cantidad <= 0) throw new Error("La cantidad debe ser mayor a 0");

      const ticketRegex = /^TICKET-\d{8}-\d{4}$/;
      if (!ticketRegex.test(numero_ticket)) {
        throw new Error("Formato de ticket inválido");
      }

      const [ticketExistente] = await connection.query(
        "SELECT id FROM prestamos WHERE numero_ticket = ?",
        [numero_ticket.trim()]
      );

      if (ticketExistente.length > 0) {
        throw new Error("El número de ticket ya existe");
      }

      const [herramienta] = await connection.query(
        "SELECT id, cantidad_disponible, nombre_herramienta FROM herramientas WHERE id = ?",
        [herramienta_id]
      );

      if (herramienta.length === 0) {
        throw new Error("Herramienta no encontrada");
      }

      if (herramienta[0].cantidad_disponible < cantidad) {
        throw new Error(
          `Stock insuficiente. Stock disponible: ${herramienta[0].cantidad_disponible}`
        );
      }

      const [result] = await connection.query(
        `INSERT INTO prestamos 
        (numero_ticket, herramienta_id, cantidad, responsable, lugar_uso, usuario_id, estado) 
        VALUES (?, ?, ?, ?, ?, ?, 'Activo')`,
        [
          numero_ticket.trim(),
          herramienta_id,
          cantidad,
          responsable.trim(),
          lugar_uso.trim(),
          usuarioDecodificado.id,
        ]
      );

      await connection.query(
        `UPDATE herramientas SET 
        cantidad_disponible = cantidad_disponible - ?,
        cantidad_prestamo = cantidad_prestamo + ?
        WHERE id = ?`,
        [cantidad, cantidad, herramienta_id]
      );

      const [nuevoPrestamo] = await connection.query(
        `SELECT 
            p.*,
            h.nombre_herramienta,
            h.cantidad_disponible,
            u.nombre_completo as nombre_usuario 
        FROM prestamos p 
        JOIN herramientas h ON p.herramienta_id = h.id 
        JOIN usuarios u ON p.usuario_id = u.id
        WHERE p.id = ?`,
        [result.insertId]
      );

      await connection.commit();

      res.status(201).json({
        message: "Préstamo registrado exitosamente",
        prestamo: nuevoPrestamo[0],
      });
    } catch (error) {
      await connection.rollback();
      let statusCode = 500;
      let message = "Error en el registro de préstamo";

      switch (error.message) {
        case "Token no proporcionado":
        case "Token inválido":
          statusCode = 401;
          message = error.message;
          break;
        case "No autorizado":
          statusCode = 403;
          message = "No tienes permiso para crear préstamos";
          break;
        case "El número de ticket ya existe":
        case "Formato de ticket inválido":
        case "Herramienta no encontrada":
        case "La herramienta no está disponible actualmente":
          statusCode = 400;
          message = error.message;
          break;
      }

      console.error("Error en crearPrestamo:", error);
      res.status(statusCode).json({
        message,
        error: error.message,
      });
    } finally {
      connection.release();
    }
  },

  listarPrestamos: async (req, res) => {
    try {
      verificarToken(req);

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;
      const search = req.query.search || "";
      const estado = req.query.estado || "";

      let whereClause = "";
      let params = [];

      if (search) {
        whereClause += `
          WHERE (p.numero_ticket LIKE ? OR 
          h.nombre_herramienta LIKE ? OR 
          p.responsable LIKE ?)
        `;
        params = [`%${search}%`, `%${search}%`, `%${search}%`];
      }

      if (estado) {
        whereClause += whereClause ? " AND" : " WHERE";
        whereClause += " p.estado = ?";
        params.push(estado);
      }

      const [total] = await promisePool.query(
        `
          SELECT COUNT(*) as total 
          FROM prestamos p 
          JOIN herramientas h ON p.herramienta_id = h.id
          ${whereClause}
        `,
        params
      );

      const [prestamos] = await promisePool.query(
        `
          SELECT 
              p.*,
              h.nombre_herramienta,
              u.nombre_completo as nombre_usuario,
              ud.nombre_completo as usuario_devolucion
          FROM prestamos p 
          JOIN herramientas h ON p.herramienta_id = h.id
          JOIN usuarios u ON p.usuario_id = u.id
          LEFT JOIN usuarios ud ON p.usuario_devolucion_id = ud.id
          ${whereClause}
          ORDER BY p.fecha_prestamo DESC
          LIMIT ? OFFSET ?
        `,
        [...params, limit, offset]
      );

      res.status(200).json({
        prestamos,
        pagination: {
          total: total[0].total,
          pages: Math.ceil(total[0].total / limit),
          currentPage: page,
          limit,
        },
      });
    } catch (error) {
      if (
        error.message === "Token no proporcionado" ||
        error.message === "Token inválido"
      ) {
        return res.status(401).json({ message: error.message });
      }
      console.error("Error al listar préstamos:", error);
      res.status(500).json({
        message: "Error al listar préstamos",
        error: error.message,
      });
    }
  },

  obtenerPrestamo: async (req, res) => {
    try {
      verificarToken(req);
      const { id } = req.params;

      const [prestamos] = await promisePool.query(
        `
          SELECT 
              p.*,
              h.nombre_herramienta,
              h.cantidad_disponible,
              u.nombre_completo as nombre_usuario,
              ud.nombre_completo as usuario_devolucion
          FROM prestamos p 
          JOIN herramientas h ON p.herramienta_id = h.id 
          JOIN usuarios u ON p.usuario_id = u.id
          LEFT JOIN usuarios ud ON p.usuario_devolucion_id = ud.id
          WHERE p.id = ?
        `,
        [id]
      );

      if (prestamos.length === 0) {
        return res.status(404).json({ message: "Préstamo no encontrado" });
      }

      res.status(200).json(prestamos[0]);
    } catch (error) {
      if (
        error.message === "Token no proporcionado" ||
        error.message === "Token inválido"
      ) {
        return res.status(401).json({ message: error.message });
      }
      console.error("Error al obtener préstamo:", error);
      res.status(500).json({
        message: "Error al obtener préstamo",
        error: error.message,
      });
    }
  },

  devolverPrestamo: async (req, res) => {
    const connection = await promisePool.getConnection();
    try {
      await connection.beginTransaction();

      const usuarioDecodificado = verificarToken(req);

      if (usuarioDecodificado.rol !== "Administrador") {
        throw new Error("No autorizado");
      }

      const { id } = req.params;
      const { observaciones } = req.body;

      const [prestamo] = await connection.query(
        "SELECT * FROM prestamos WHERE id = ?",
        [id]
      );

      if (prestamo.length === 0) {
        throw new Error("Préstamo no encontrado");
      }

      if (prestamo[0].estado === "Devuelto") {
        throw new Error("Este préstamo ya ha sido devuelto");
      }

      await connection.query(
        `UPDATE prestamos SET 
          estado = 'Devuelto',
          fecha_devolucion = CURRENT_TIMESTAMP,
          observaciones = ?,
          usuario_devolucion_id = ?
        WHERE id = ?`,
        [observaciones || null, usuarioDecodificado.id, id]
      );

      // Actualización corregida de la herramienta (sin la columna estado)
      await connection.query(
        `UPDATE herramientas SET 
          cantidad_disponible = cantidad_disponible + ?,
          cantidad_prestamo = cantidad_prestamo - ?
        WHERE id = ?`,
        [prestamo[0].cantidad, prestamo[0].cantidad, prestamo[0].herramienta_id]
      );

      const [prestamoActualizado] = await connection.query(
        `
          SELECT 
              p.*,
              h.nombre_herramienta,
              h.cantidad_disponible,
              u.nombre_completo as nombre_usuario,
              ud.nombre_completo as usuario_devolucion
          FROM prestamos p 
          JOIN herramientas h ON p.herramienta_id = h.id 
          JOIN usuarios u ON p.usuario_id = u.id
          LEFT JOIN usuarios ud ON p.usuario_devolucion_id = ud.id
          WHERE p.id = ?
        `,
        [id]
      );

      await connection.commit();

      res.status(200).json({
        message: "Préstamo devuelto exitosamente",
        prestamo: prestamoActualizado[0],
      });
    } catch (error) {
      await connection.rollback();
      let statusCode = 500;
      let message = "Error al devolver préstamo";

      switch (error.message) {
        case "Token no proporcionado":
        case "Token inválido":
          statusCode = 401;
          message = error.message;
          break;
        case "No autorizado":
          statusCode = 403;
          message = "No tienes permiso para devolver préstamos";
          break;
        case "Préstamo no encontrado":
        case "Este préstamo ya ha sido devuelto":
          statusCode = 400;
          message = error.message;
          break;
      }

      console.error("Error al devolver préstamo:", error);
      res.status(statusCode).json({
        message,
        error: error.message,
      });
    } finally {
      connection.release();
    }
  },
};

module.exports = prestamosController;