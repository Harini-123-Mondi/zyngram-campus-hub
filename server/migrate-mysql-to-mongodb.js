import "dotenv/config";
import mysql from "mysql2/promise";
import { MongoClient } from "mongodb";

const source = await mysql.createConnection({
  host: process.env.MYSQL_SOURCE_HOST || "127.0.0.1",
  port: Number(process.env.MYSQL_SOURCE_PORT || 3306),
  user: process.env.MYSQL_SOURCE_USER,
  password: process.env.MYSQL_SOURCE_PASSWORD,
  database: process.env.MYSQL_SOURCE_DB || "zyngram_campus_hub"
});
const client = new MongoClient(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017");

try {
  const [tables] = await source.query("SHOW TABLES");
  const tableNames = new Set(Object.values(tables).map((row) => Object.values(row)[0]));
  if (!tableNames.has("users") || !tableNames.has("modules")) {
    throw new Error("The source database must contain both users and modules tables.");
  }

  const [sourceUsers] = await source.query(`
    SELECT id, name, email, role, title, initials, color, salt, password_hash,
      created_at, updated_at
    FROM users
  `);
  const [sourceModules] = await source.query(`
    SELECT id, title, category, description, created_at, updated_at
    FROM modules
  `);

  await client.connect();
  const destination = client.db(process.env.MONGODB_DB || "zyngram_campus_hub");
  const users = destination.collection("users");
  const modules = destination.collection("modules");
  await users.createIndex({ email: 1 }, { unique: true });
  await modules.createIndex({ updatedAt: -1, title: 1 });

  const normalizedUsers = sourceUsers.map((user) => ({
    _id: String(user.id),
    name: user.name,
    email: user.email.toLowerCase(),
    role: user.role,
    title: user.title,
    initials: user.initials,
    color: user.color,
    salt: user.salt,
    hash: user.password_hash,
    createdAt: new Date(user.created_at),
    updatedAt: new Date(user.updated_at)
  }));
  const currentUsers = await users.find({
    $or: [
      { _id: { $in: normalizedUsers.map((user) => user._id) } },
      { email: { $in: normalizedUsers.map((user) => user.email) } }
    ]
  }, { projection: { _id: 1, email: 1 } }).toArray();
  const currentUsersById = new Map(currentUsers.map((user) => [user._id, user]));
  const currentUsersByEmail = new Map(currentUsers.map((user) => [user.email.toLowerCase(), user]));

  for (const user of normalizedUsers) {
    const byId = currentUsersById.get(user._id);
    const byEmail = currentUsersByEmail.get(user.email);
    if ((byId && byId.email.toLowerCase() !== user.email)
      || (byEmail && byEmail._id !== user._id)) {
      throw new Error("A destination user ID/email conflicts with the MySQL source. No records were imported; resolve the conflict before retrying.");
    }
  }

  const normalizedModules = sourceModules.map((module) => ({
    _id: String(module.id),
    title: module.title,
    category: module.category,
    description: module.description,
    createdAt: new Date(module.created_at),
    updatedAt: new Date(module.updated_at)
  }));

  if (normalizedUsers.length) {
    await users.bulkWrite(normalizedUsers.map((user) => ({
      updateOne: {
        filter: { _id: user._id },
        update: { $set: Object.fromEntries(Object.entries(user).filter(([key]) => key !== "_id")) },
        upsert: true
      }
    })));
  }
  if (normalizedModules.length) {
    await modules.bulkWrite(normalizedModules.map((module) => ({
      updateOne: {
        filter: { _id: module._id },
        update: { $set: Object.fromEntries(Object.entries(module).filter(([key]) => key !== "_id")) },
        upsert: true
      }
    })));
  }

  console.log(`Migration complete: ${normalizedUsers.length} users and ${normalizedModules.length} modules copied to MongoDB.`);
} finally {
  await source.end();
  await client.close();
}
