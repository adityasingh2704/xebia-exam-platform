const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://adityasinghasks_db_user:XERECRUIT123456@cluster0.79ua2y5.mongodb.net/?appName=Cluster0';

async function main() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('Connected to MongoDB cluster.');
    
    // Check if quickshow exists
    const adminDb = client.db('admin');
    const dbs = await adminDb.admin().listDatabases();
    const dbExists = dbs.databases.some(db => db.name === 'quickshow');
    
    if (dbExists) {
      const db = client.db('quickshow');
      await db.dropDatabase();
      console.log('Successfully deleted the old "quickshow" database from BOOKYOURSHOW!');
    } else {
      console.log('The "quickshow" database is already deleted.');
    }

  } catch(e) {
      console.error(e);
  } finally {
    await client.close();
  }
}

main();
