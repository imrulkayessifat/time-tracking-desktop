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
    constructor(private apiEndpoint: string) { }

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

    /**
     * Fetches the screenshot interval from the configuration API
     * @returns Promise<number> The screenshot interval value
     * @throws Error if the API call fails
     */
    public async getScreenShotInterval(): Promise<number> {
        try {
            const response = await axios.get<ConfigurationResponse>(this.apiEndpoint, {
                headers: this.getAuthHeaders()
            });
            console.log("screenshot interval : ", response.data.data.config.screen_shot_interval)
            return response.data.data.config.screen_shot_interval ?? 1;
        } catch (error) {
            console.error('Error fetching screenshot interval:', error);
            throw error;
        }
    }
}