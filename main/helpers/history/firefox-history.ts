import { app } from 'electron';

import path from 'path';
import { homedir } from 'os';
import { promises as fs } from 'fs';
import { copyFileSync } from 'fs';

import Database from '../db';

function getFirefoxProfilePath() {
    switch (process.platform) {
        case 'win32':
            return path.join(process.env.APPDATA, 'Mozilla/Firefox/Profiles');
        case 'darwin':
            return path.join(homedir(), 'Library/Application Support/Firefox/Profiles');
        default: // Linux
            return path.join(homedir(), '.mozilla/firefox');
    }
}

// Function to find places.sqlite file
async function findPlacesDatabase() {
    const profilesPath = getFirefoxProfilePath();

    try {
        const profiles = await fs.readdir(profilesPath);

        for (const profile of profiles) {
            if (profile.endsWith('.default') || profile.endsWith('.default-release')) {
                const dbPath = path.join(profilesPath, profile, 'places.sqlite');

                try {
                    await fs.access(dbPath);
                    return dbPath;
                } catch {
                    continue;
                }
            }
        }

        throw new Error('Firefox history database not found');
    } catch (error) {
        throw new Error(`Error accessing Firefox profile: ${error.message}`);
    }
}

// Function to query the database
async function queryDatabase(dbPath) {
    // Create a copy of the database file since Firefox might have it locked
    const tempDbPath = path.join(app.getPath('temp'), 'places-temp.sqlite');
    copyFileSync(dbPath, tempDbPath);

    try {
        const db = new Database(tempDbPath, { readonly: true });

        const sql = `
        SELECT 
            p.url,
            p.title,
            datetime(h.visit_date/1000000, 'unixepoch') as visit_date,
            h.visit_type
        FROM moz_places p
        JOIN moz_historyvisits h ON p.id = h.place_id
        ORDER BY h.visit_date DESC
        LIMIT 1`;

        const latestVisit = db.prepare(sql).all();

        // Close database and clean up
        db.close();
        await fs.unlink(tempDbPath);

        return latestVisit;
    } catch (error) {
        // Clean up temp file if there was an error
        try {
            await fs.unlink(tempDbPath);
        } catch {
            // Ignore cleanup errors
        }
        throw error;
    }
}

// Function to read browser history
export async function readFirefoxHistory() {
    try {
        const dbPath = await findPlacesDatabase();
        return await queryDatabase(dbPath);
    } catch (error) {
        throw new Error(`Failed to read browser history: ${error.message}`);
    }
}