import { notarize } from '@electron/notarize';


exports.default = async function notarizing(context) {
    const { electronPlatformName, appOutDir } = context;
    if (electronPlatformName !== 'darwin') {
        return;
    }

    const appName = context.packager.appInfo.productFilename;
    const appId = context.packager.appInfo.id;

    return await notarize({
        appBundleId: appId,
        appPath: `${appOutDir}/${appName}.app`,
        appleId: 'apps@asdbd.com',
        appleIdPassword: 'mjzv-dfxk-yxkt-fuct',
        tool: "legacy"
    });
};
