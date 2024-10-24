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

async function createTempCopy(dbPath: string): Promise<string> {
    const tempPath = path.join(app.getPath('temp'), `places-${Date.now()}.sqlite`);
    await copyFile(dbPath, tempPath);
    return tempPath;
}

function cleanupTempFile(tempPath: string) {
    fs.unlink(tempPath).catch(err => {
        console.error('Failed to cleanup temporary database file:', err);
    });
}

async function queryFirefoxDatabase(dbPath: string): Promise<FirefoxHistoryEntry[]> {
    // Create a temporary copy of the database
    const tempDbPath = await createTempCopy(dbPath);

    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(tempDbPath, sqlite3.OPEN_READONLY, (err: Error | null) => {
            if (err) {
                cleanupTempFile(tempDbPath);
                return reject(new Error(`Failed to open database: ${err.message}`));
            }
        });

        db.serialize(() => {
            // Reduced timeout since we're working with a copy
            db.run('PRAGMA busy_timeout = 1000;');

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
                    cleanupTempFile(tempDbPath);
                    return reject(new Error(`Failed to query database: ${err.message}`));
                }

                db.close((closeErr: Error | null) => {
                    cleanupTempFile(tempDbPath);
                    if (closeErr) {
                        return reject(new Error(`Failed to close the database: ${closeErr.message}`));
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

        const latestVisits = await queryFirefoxDatabase(dbPath);
        if (latestVisits.length > 0) {
            console.log("Latest visited URLs: ", latestVisits);
            return latestVisits[0]; // Returning the most recent visit
        } else {
            console.log('No recent history found.');
            return null;
        }
    } catch (error) {
        throw new Error(`Failed to read Firefox history: ${error.message}`);
    }
}