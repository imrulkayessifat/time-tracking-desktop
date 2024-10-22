import { app } from 'electron';
import path from 'path';
import { homedir } from 'os';
import { promises as fs } from 'fs';
import { copyFileSync } from 'fs';

import Database from '../db';

function getEdgeProfilePath() {
    switch (process.platform) {
        case 'win32':
            return path.join(process.env.LOCALAPPDATA, 'Microsoft/Edge/User Data/Default');
        case 'darwin':
            return path.join(homedir(), 'Library/Application Support/Microsoft Edge/Default');
        default: // Linux
            return path.join(homedir(), '.config/microsoft-edge/Default');
    }
}

async function queryChromiumDatabase(dbPath, browser) {
    const tempDbPath = path.join(app.getPath('temp'), `${browser}-history-temp.sqlite`);
    copyFileSync(dbPath, tempDbPath);

    try {
        const db = new Database(tempDbPath, { readonly: true });
        const sql = `
            SELECT
                urls.url,
                urls.title,
                datetime(visits.visit_time/1000000-11644473600, 'unixepoch') as visit_date,
                visits.transition
            FROM urls
            JOIN visits ON urls.id = visits.url
            ORDER BY visits.visit_time DESC
            LIMIT 1`;

        const latestVisit = db.prepare(sql).get();
        db.close();
        await fs.unlink(tempDbPath);
        return latestVisit;
    } catch (error) {
        try {
            await fs.unlink(tempDbPath);
        } catch {
            // Ignore cleanup errors
        }
        throw error;
    }
}


export async function readEdgeHistory() {
    try {
        const dbPath = path.join(getEdgeProfilePath(), 'History');
        return await queryChromiumDatabase(dbPath, 'edge');
    } catch (error) {
        throw new Error(`Failed to read Edge history: ${error.message}`);
    }
}