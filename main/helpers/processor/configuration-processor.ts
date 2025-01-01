import axios from 'axios';

import AuthTokenStore from '../auth-token-store';

interface ConfigurationResponse {
    data: {
        config: {
            screen_shot_interval: number;
        }
    }
}

export class ConfigurationProcessor {
    private processingInterval: NodeJS.Timeout | null = null;
    private isProcessing: boolean = false;
    private currentConfig: ConfigurationResponse['data'] | null = null;

    constructor(
        private apiEndpoint: string,
        private intervalMs: number = 30000
    ) { }

    private getAuthHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };

        const tokenStore = AuthTokenStore.getInstance();
        const token = tokenStore.getToken();

        if (token) {
            headers['Authorization'] = token;
        }

        return headers;
    }

    // Get the current screenshot interval
    public getScreenShotInterval(): number | null {
        return this.currentConfig?.config?.screen_shot_interval ?? 1;
    }

    // Start the processing loop
    public startProcessing(): void {
        console.log('Starting configuration processing...');

        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
        }

        this.fetchConfiguration()
            .then(() => console.log('Initial configuration fetch completed'))
            .catch(err => console.error('Error in initial configuration fetch:', err));

        this.processingInterval = setInterval(() => {
            console.log('Interval triggered, starting new configuration fetch');
            this.fetchConfiguration()
                .then(() => console.log('Configuration fetch completed'))
                .catch(err => console.error('Error in configuration fetch:', err));
        }, this.intervalMs);
    }

    // Stop the processing loop
    public stopProcessing(): void {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
        } else {
            console.log('No processing was running');
        }
    }

    // Fetch configuration from the API
    private async fetchConfiguration(): Promise<void> {

        if (this.isProcessing) {
            console.log('Already fetching configuration, skipping this cycle');
            return;
        }

        this.isProcessing = true;

        try {
            console.log('Making API call for configuration');

            const response = await axios.get(this.apiEndpoint, {
                headers: this.getAuthHeaders()
            });

            const configData: ConfigurationResponse = response.data;
            this.currentConfig = configData.data;

            console.log('Successfully updated configuration:', this.currentConfig.config);

        } catch (error) {
            console.error('Error fetching configuration:', error);
            throw error;
        } finally {
            this.isProcessing = false;
            console.log('Processing lock released');
        }
    }
}