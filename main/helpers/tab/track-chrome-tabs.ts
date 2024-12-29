const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);


export async function trackChromeTabs() {
    try {
        const { stdout } = await execPromise('pgrep -f "chrome"');
        const chromePids = stdout.split('\n').filter(Boolean);

        for (const pid of chromePids) {
            const { stdout: cmdline } = await execPromise(`cat /proc/${pid}/cmdline`);
            if (cmdline.includes('--type=renderer')) {
                // This is a Chrome tab process
                const { stdout: environ } = await execPromise(`cat /proc/${pid}/environ`);
                // Parse environment variables to get tab details
                const envVars = environ.split('\0');
                const tabUrl = envVars.find(v => v.startsWith('CHROME_RENDERER_URL='));
                if (tabUrl) {
                    return tabUrl.replace('CHROME_RENDERER_URL=', '');
                }
            }
        }
    } catch (error) {
        console.error('Error tracking Chrome tabs:', error);
        return null;
    }
}
