const mysql = require('mysql2');
const dotenv = require('dotenv');

// Carga las variables de entorno al inicio del archivo
dotenv.config();

// Crea el pool de conexiones
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Convierte el pool a una versión con promesas
const promisePool = pool.promise();

// Función para probar la conexión
const testConnection = () => {
  return new Promise((resolve, reject) => {
    pool.getConnection((err, connection) => {
      if (err) {
        console.error('❌ Error al conectar a la base de datos:', err);
        return reject(err);
      }
      
      console.log('✅ Conexión a la base de datos establecida correctamente');
      connection.release();
      resolve();
    });
  });
};

// Ejecuta la prueba de conexión
testConnection().catch(error => {
  console.error('Error en la conexión:', error);
});

module.exports = {
  promisePool,
  testConnection
};