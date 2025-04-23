// src/helpers/timestamp.ts
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { getLocalTime } from './lib/getLocalTime';

const timestampPath = path.join(app.getPath('userData'), 'lastCloseTime.json');
const tempPath = `${timestampPath}.tmp`;

export function getLastCloseTime(): string | null {
  try {
    if (fs.existsSync(timestampPath)) {
      const data = fs.readFileSync(timestampPath, 'utf-8');
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed.lastCloseTime === 'string') {
        return parsed.lastCloseTime;
      }
    }
  } catch (error) {
    console.error('Failed to read lastCloseTime:', error);
  }
  return null;
}

export function updateTimestamp(): void {
  const timestamp = getLocalTime();
  const jsonData = JSON.stringify({ lastCloseTime: timestamp });
  try {
    fs.writeFileSync(tempPath, jsonData);
    fs.renameSync(tempPath, timestampPath); // atomic rename
  } catch (error) {
    console.error('Failed to write timestamp atomically:', error);
  }
}
