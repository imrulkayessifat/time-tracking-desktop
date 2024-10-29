import * as fs from 'fs';
import path from 'path';
import { app } from 'electron';

interface ProcessorConfig {
    apiEndpoint: string;
    intervalMs: number;
}

export const loadProcessorConfig = async (): Promise<ProcessorConfig> => {
    try {
        // Determine the path to the .env file in the resources folder
        let envPath: string;

        if (app.isPackaged) {
            // In production, the resources folder is in a different location
            envPath = path.join(process.resourcesPath, '.env');
        } else {
            // In development, use the resources folder in the project directory
            envPath = path.join(__dirname, '..', 'renderer', '.env');
        }

        console.log('Loading environment from:', envPath);

        // Read and parse the .env file
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, 'utf-8');
            const envConfig = envContent.split('\n').reduce((acc, line) => {
                const [key, value] = line.split('=').map(str => str.trim());
                if (key && value) {
                    acc[key] = value.replace(/^["']|["']$/g, ''); // Remove quotes if present
                }
                return acc;
            }, {} as Record<string, string>);

            console.log('Loaded environment variables:', envConfig);

            return {
                apiEndpoint: `${envConfig.NEXT_PUBLIC_BASE_URL}`,
                intervalMs: 120000
            };
        } else {
            throw new Error(`Environment file not found at ${envPath}`);
        }
    } catch (error) {
        console.error('Error loading processor config:', error);
        throw error;
    }
};