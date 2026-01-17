const { execSync } = require('child_process');
const path = require('path');

exports.default = async function notarizing(context) {
    const { electronPlatformName, appOutDir } = context;

    if (electronPlatformName !== 'darwin') {
        return;
    }

    const { notarize } = await import('@electron/notarize');

    const appName = context.packager.appInfo.productFilename;
    const appPath = path.join(appOutDir, `${appName}.app`);

    console.log(`Notarizing ${appPath}...`);

    try {
        await notarize({
            appPath,
            appleId: process.env.APPLE_ID,
            appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
            teamId: process.env.APPLE_TEAM_ID,
        });

        console.log('Notarization complete! Stapling the ticket...');

        // Explicitly staple the ticket for Gatekeeper bypass
        execSync(`xcrun stapler staple "${appPath}"`);

        console.log('Stapling complete!');
    } catch (error) {
        console.error('Notarization/Stapling failed:', error);
        throw error;
    }
};
