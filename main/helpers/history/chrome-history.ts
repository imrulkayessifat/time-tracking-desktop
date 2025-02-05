const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

export async function readChromeHistory() {
    try {
        let command;

        if (process.platform === 'win32') {
            // Windows approach using PowerShell
            command = `
                Add-Type -AssemblyName UIAutomationClient
                $automation = [Windows.Automation.AutomationElement]::RootElement
                $chrome = $automation.FindFirst(
                    [System.Windows.Automation.TreeScope]::Children,
                    (New-Object System.Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::NameProperty, "Google Chrome"))
                )
                if ($chrome) {
                    $addressBar = $chrome.FindFirst(
                        [System.Windows.Automation.TreeScope]::Descendants,
                        (New-Object System.Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::AutomationIdProperty, "address and search bar"))
                    )
                    if ($addressBar) {
                        $pattern = $addressBar.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
                        $pattern.Current.Value
                    }
                }
            `;
            const { stdout } = await execPromise(`powershell -command "${command}"`);
            return stdout.trim();
        }
        else if (process.platform === 'darwin') {
            // macOS approach using AppleScript
            command = `
                osascript -e '
                tell application "Google Chrome"
                    get URL of active tab of first window
                end tell'
            `;
            const { stdout } = await execPromise(command);
            return stdout.trim();
        }
        else if (process.platform === 'linux') {
            // Linux approach using xdotool and wmctrl
            // Note: Requires xdotool and wmctrl to be installed
            // Install with: sudo apt-get install xdotool wmctrl
            command = `
                active_window_id=$(xdotool getactivewindow)
                window_title=$(xdotool getwindowname $active_window_id)
                echo "$window_title" | grep -oP '(?<=- Google Chrome\\s).*$'
            `;
            const { stdout } = await execPromise(command);
            return stdout.trim();
        }

        throw new Error('Unsupported operating system');
    } catch (error) {
        console.error('Error getting Chrome active tab:', error);
        return null;
    }
}