import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import plugin from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import child_process from 'child_process';
import { env } from 'process';

const baseFolder =
    env.APPDATA !== undefined && env.APPDATA !== ''
        ? `${env.APPDATA}/ASP.NET/https`
        : `${env.HOME}/.aspnet/https`;

const certificateName = "boldadhocembed.client";
const certFilePath = path.join(baseFolder, `${certificateName}.pem`);
const keyFilePath = path.join(baseFolder, `${certificateName}.key`);

if (!fs.existsSync(baseFolder)) {
    fs.mkdirSync(baseFolder, { recursive: true });
}

if (!fs.existsSync(certFilePath) || !fs.existsSync(keyFilePath)) {
    if (0 !== child_process.spawnSync('dotnet', [
        'dev-certs',
        'https',
        '--export-path',
        certFilePath,
        '--format',
        'Pem',
        '--no-password',
    ], { stdio: 'inherit', }).status) {
        throw new Error("Could not create certificate.");
    }
}

// Pick the right dev scheme based on DISABLE_DEV_HTTPS env flag.
// Set DISABLE_DEV_HTTPS=1 (or true) to run Vite over plain HTTP on Windows
// without elevated privileges. Leave unset/empty to keep the default HTTPS
// flow used by the ASP.NET Core launchSettings profile.
const useHttps = !(env.DISABLE_DEV_HTTPS === '1' || env.DISABLE_DEV_HTTPS === 'true');

const target = env.ASPNETCORE_HTTPS_PORT
    ? `https://localhost:${env.ASPNETCORE_HTTPS_PORT}`
    : (env.ASPNETCORE_URLS ? env.ASPNETCORE_URLS.split(';')[0] : 'http://localhost:5274');

const serverConfig = {
    proxy: {
        '^/weatherforecast': {
            target,
            secure: false
        },
        '^/api': {
            target,
            secure: false,
            changeOrigin: true,
        }
    },
    port: parseInt(env.DEV_SERVER_PORT || '64940'),
    // When running Vite on Windows without admin, binding to IPv6 loopback
    // ('::1') fails with EACCES. Force IPv4 loopback unless explicitly
    // overridden via DEV_SERVER_HOST.
    host: env.DEV_SERVER_HOST || (useHttps ? undefined : '127.0.0.1'),
};

if (useHttps && fs.existsSync(keyFilePath) && fs.existsSync(certFilePath)) {
    serverConfig.https = {
        key: fs.readFileSync(keyFilePath),
        cert: fs.readFileSync(certFilePath),
    };
}

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [plugin()],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    },
    server: serverConfig,
})
