function withProtocol(value) {
    if (!value) return '';
    const normalized = String(value).trim().replace(/\/$/, '');
    if (!normalized) return '';
    return /^https?:\/\//i.test(normalized) ? normalized : `https://${normalized}`;
}

function resolveBaseUrl(request = null) {
    const configured = withProtocol(process.env.BASE_URL);
    if (configured) return configured;

    if (request && request.get('host')) {
        return `${request.protocol || 'https'}://${request.get('host')}`.replace(/\/$/, '');
    }

    const vercelDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
    return withProtocol(vercelDomain) || 'http://localhost:3000';
}

module.exports = { resolveBaseUrl, withProtocol };
