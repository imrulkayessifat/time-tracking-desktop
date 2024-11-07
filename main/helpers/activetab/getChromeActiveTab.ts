const CDP = require('chrome-remote-interface');

export async function getChromeActiveTab() {
    try {
        const client = await CDP();
        await client.Runtime.enable();
        const info = await client.Runtime.evaluate({ expression: 'window.location.toString()' });
        const url = info.result.value;
        // console.log(url);

        // Close the connection
        await client.close();

        return { url };
    } catch (error) {
        throw new Error(`Failed to get Chrome active tab: ${error.message}`);
    }
}