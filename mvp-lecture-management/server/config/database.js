const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    console.log(`Database: ${conn.connection.name}`);
    
    return conn;
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

// Function to clear old database (for cleanup)
const clearOldDatabase = async (dbName) => {
  try {
    const conn = await mongoose.connect(`mongodb://localhost:27017/${dbName}`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    await conn.connection.dropDatabase();
    console.log(`✅ Database '${dbName}' cleared successfully`);
    await conn.connection.close();
  } catch (error) {
    console.error(`❌ Error clearing database: ${error.message}`);
  }
};

module.exports = { connectDB, clearOldDatabase };
