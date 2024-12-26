import { app } from 'electron';
import path from 'path';
import { homedir } from 'os';
import { promises as fs } from 'fs';
import { copyFileSync } from 'fs';

import Database from '../db';

function getSafariHistoryPath() {
    if (process.platform !== 'darwin') {
        throw new Error('Safari history is only available on macOS');
    }
    return path.join(homedir(), 'Library/Safari/History.db');
}

async function querySafariDatabase(dbPath) {
    const tempDbPath = path.join(app.getPath('temp'), 'safari-history-temp.sqlite');
    copyFileSync(dbPath, tempDbPath);

    try {
        const db = new Database(tempDbPath, { readonly: true });
        const sql = `
            SELECT
                history_items.url,
                history_items.domain_expansion,
                datetime(history_visits.visit_time + 978307200, 'unixepoch') as visit_date
            FROM history_items
            JOIN history_visits ON history_items.id = history_visits.history_item
            ORDER BY history_visits.visit_time DESC
            LIMIT 1`;

        const latestVisit = db.prepare(sql).get();
        db.close();
        await fs.unlink(tempDbPath);
        return {
            url: latestVisit.url
        };
    } catch (error) {
        try {
            await fs.unlink(tempDbPath);
        } catch {
            // Ignore cleanup errors
        }
        throw error;
    }
}

export async function readSafariHistory() {
    try {
        if (process.platform !== 'darwin') {
            throw new Error('Safari history is only available on macOS');
        }
        const dbPath = getSafariHistoryPath();
        
        return await querySafariDatabase(dbPath);
    } catch (error) {
        throw new Error(`Failed to read Safari history: ${error.message}`);
    }
}