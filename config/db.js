const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is missing from student/.env');

const client = new MongoClient(uri);
const databaseName = process.env.MONGODB_DATABASE || 'thi_truc_tuyen';
const db = () => client.db(databaseName);

module.exports = { client, db, databaseName, uri };