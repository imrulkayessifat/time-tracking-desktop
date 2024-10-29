import AuthTokenStore from '../auth-token-store';

interface ConfigurationResponse {
    data: {
        screen_shot_interval: number;
    }
}

export class ConfigurationProcessor {
    private processingInterval: NodeJS.Timeout | null = null;
    private isProcessing: boolean = false;
    private currentConfig: ConfigurationResponse['data'] | null = null;

    constructor(
        private apiEndpoint: string,
        private intervalMs: number = 30000
    ) {}

    private getAuthHeaders(): Headers {
        const headers = new Headers({
            'Content-Type': 'application/json'
        });

        const tokenStore = AuthTokenStore.getInstance();
        const token = tokenStore.getToken();

        if (token) {
            headers.append('Authorization', `${token}`);
        }

        return headers;
    }

    // Get the current screenshot interval
    public getScreenShotInterval(): number | null {
        return this.currentConfig?.screen_shot_interval ?? null;
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
            
            const response = await fetch(this.apiEndpoint, {
                method: 'GET',
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error(`API call failed: ${response.statusText}`);
            }

            const configData: ConfigurationResponse = await response.json();
            this.currentConfig = configData.data;

            console.log('Successfully updated configuration:', this.currentConfig);

        } catch (error) {
            console.error('Error fetching configuration:', error);
            throw error;
        } finally {
            this.isProcessing = false;
            console.log('Processing lock released');
        }
    }
}