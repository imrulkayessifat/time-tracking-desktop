import Database from './db';
import { readBrowserHistory } from './history';

const db = new Database('timetracking.db');
db.prepare(`
  CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_name TEXT,
    url TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

const startTracking = async () => {
    try {
        const { activeWindow } = await import('../../node_modules/get-windows');
        const history = await readBrowserHistory()
        console.log(history)
        const result = await activeWindow()
        const stmt = db.prepare('INSERT INTO activities (app_name, url) VALUES (?, ?)');
        stmt.run(result.owner.name, result.title);
        console.log(result)
    } catch (error) {
        console.error('Error tracking active window:', error);
    }
}

export default startTracking