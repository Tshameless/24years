export function validateDeploymentOrigin(config: {
  nodeEnv?: string;
  appOrigin?: string;
  secureCookie?: string;
}): void {
  if ((config.nodeEnv === 'production' || config.secureCookie === 'true') && !config.appOrigin) {
    throw new Error(
      'Production deployments and secure cookies require APP_ORIGIN to be configured.',
    );
  }
}
