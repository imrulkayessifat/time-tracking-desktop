import { app } from 'electron';
import path from 'path';
import { homedir } from 'os';
import { promises as fs } from 'fs';
import { copyFile } from 'fs/promises';
const sqlite3 = require('sqlite3').verbose();

interface FirefoxHistoryEntry {
  url: string;
  title: string;
  visit_date: number;
}

function getFirefoxProfilePath() {
  switch (process.platform) {
    case 'win32':
      return path.join(process.env.APPDATA!, 'Mozilla', 'Firefox', 'Profiles');
    case 'darwin':
      return path.join(homedir(), 'Library', 'Application Support', 'Firefox', 'Profiles');
    default: // Linux
      return path.join(homedir(), '.mozilla', 'firefox');
  }
}

async function findDefaultProfile() {
  const profilesPath = getFirefoxProfilePath();
  const profiles = await fs.readdir(profilesPath);
  const defaultProfile = profiles.find(profile =>
    profile.endsWith('.default') || profile.endsWith('.default-release')
  );

  if (!defaultProfile) {
    throw new Error('No default Firefox profile found');
  }
  return path.join(profilesPath, defaultProfile);
}

async function copyDatabaseFiles(dbPath: string): Promise<string> {
  const timestamp = Date.now();
  const tempBasePath = path.join(app.getPath('temp'), `places-${timestamp}`);
  const tempMainDb = `${tempBasePath}.sqlite`;

  // Copy main database file
  await copyFile(dbPath, tempMainDb);

  // Check for and copy WAL file if it exists
  const walPath = `${dbPath}-wal`;
  try {
    await fs.access(walPath);
    await copyFile(walPath, `${tempMainDb}-wal`);
  } catch (error) {
    // WAL file doesn't exist, which is fine
  }

  // Check for and copy SHM file if it exists
  const shmPath = `${dbPath}-shm`;
  try {
    await fs.access(shmPath);
    await copyFile(shmPath, `${tempMainDb}-shm`);
  } catch (error) {
    // SHM file doesn't exist, which is fine
  }

  return tempMainDb;
}

async function cleanupTempFiles(tempBasePath: string) {
  const filesToCleanup = [
    tempBasePath,
    `${tempBasePath}-wal`,
    `${tempBasePath}-shm`
  ];

  for (const file of filesToCleanup) {
    try {
      await fs.unlink(file);
    } catch (error) {
      console.error(`Failed to cleanup temporary file ${file}:`, error);
    }
  }
}

async function queryFirefoxDatabase(dbPath: string): Promise<FirefoxHistoryEntry[]> {
  // Create temporary copies of all database files
  const tempDbPath = await copyDatabaseFiles(dbPath);

  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(tempDbPath, sqlite3.OPEN_READONLY, (err: Error | null) => {
      if (err) {
        cleanupTempFiles(tempDbPath);
        return reject(new Error(`Failed to open database: ${err.message}`));
      }
    });

    db.serialize(() => {
      // Configure database
      db.run('PRAGMA busy_timeout = 1000;');
      db.run('PRAGMA journal_mode = WAL;'); // Explicitly set WAL mode to ensure WAL file is read

      const sql = `
        SELECT
          p.url,
          p.title,
          v.visit_date / 1000000 AS visit_date
        FROM
          moz_places p
        JOIN
          moz_historyvisits v ON p.id = v.place_id
        ORDER BY
          v.visit_date DESC
        LIMIT 10;
      `;

      db.all(sql, [], (err: Error | null, rows: FirefoxHistoryEntry[]) => {
        if (err) {
          db.close();
          cleanupTempFiles(tempDbPath);
          return reject(new Error(`Failed to query database: ${err.message}`));
        }

        db.close((closeErr: Error | null) => {
          cleanupTempFiles(tempDbPath);
          if (closeErr) {
            return reject(new Error(`Failed to close database: ${closeErr.message}`));
          }
          resolve(rows);
        });
      });
    });
  });
}

export async function readFirefoxHistory() {
  try {
    const profilePath = await findDefaultProfile();
    const dbPath = path.join(profilePath, 'places.sqlite');

    // Check if database exists
    try {
      await fs.access(dbPath);
    } catch (error) {
      throw new Error('Firefox places.sqlite database not found');
    }

    const latestVisits = await queryFirefoxDatabase(dbPath);

    if (latestVisits.length > 0) {
      // console.log("Latest visited URLs: ", latestVisits);
      return {
        url: latestVisits[0]
      }; // Returning the most recent visit
    } else {
      console.log('No recent history found.');
      return null;
    }
  } catch (error) {
    throw new Error(`Failed to read Firefox history: ${error.message}`);
  }
}