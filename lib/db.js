import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error('MONGODB_URI environment variable is not set. See .env.example');
}

let client;
let db;

async function connect() {
  if (db) return db;

  try {
    client = new MongoClient(uri);
    await client.connect();
    db = client.db('cricket_scoreboard');
    console.log('✓ MongoDB connected');
    return db;
  } catch (error) {
    console.error('✗ MongoDB connection failed:', error.message);
    throw error;
  }
}

export async function getDb() {
  if (!db) await connect();
  return db;
}

// Collections
export async function getMatches() {
  const database = await getDb();
  return database.collection('matches');
}

export async function getScores() {
  const database = await getDb();
  return database.collection('scores');
}

// Create indexes
export async function initDb() {
  try {
    const matches = await getMatches();
    const scores = await getScores();

    // Matches index
    await matches.createIndex({ createdAt: -1 });
    await matches.createIndex({ status: 1 });

    // Scores index (match_id + timestamp for score history)
    await scores.createIndex({ match_id: 1, timestamp: -1 });
    await scores.createIndex({ match_id: 1 });

    console.log('✓ Database indexes created');
  } catch (error) {
    // Indexes might already exist, that's ok
    console.log('Index creation note:', error.message);
  }
}

// Helper to save full match state
export async function saveMatch(matchData) {
  try {
    const matches = await getMatches();
    const result = await matches.updateOne(
      { _id: matchData._id || matchData.id },
      { $set: { ...matchData, updatedAt: new Date() } },
      { upsert: true }
    );
    return result;
  } catch (error) {
    console.error('Failed to save match:', error);
    throw error;
  }
}

// Helper to get current match
export async function getCurrentMatch() {
  try {
    const matches = await getMatches();
    return await matches.findOne(
      { status: { $in: ['innings1', 'innings2', 'innings_break'] } },
      { sort: { createdAt: -1 } }
    );
  } catch (error) {
    console.error('Failed to get current match:', error);
    return null;
  }
}

// Helper to get all completed matches
export async function getMatchHistory(limit = 10) {
  try {
    const matches = await getMatches();
    return await matches
      .find({ status: 'completed' })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  } catch (error) {
    console.error('Failed to get match history:', error);
    return [];
  }
}

// Initialize on module load
if (typeof window === 'undefined') {
  // Server-side only
  initDb().catch(console.error);
}
