export const getLocalTime = (): string => {
    const currentUtcTime = new Date();
    const localTimeOffset = currentUtcTime.getTimezoneOffset() * 60000; // Convert offset to milliseconds
    return new Date(currentUtcTime.getTime() - localTimeOffset).toISOString()
};