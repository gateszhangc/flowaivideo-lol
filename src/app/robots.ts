import { MetadataRoute } from 'next';

import { envConfigs } from '@/config';

export default function robots(): MetadataRoute.Robots {
  const appUrl = (envConfigs.app_url || 'https://flowaivideo.lol').replace(/\/$/, '');

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/*', '/settings/*', '/activity/*', '/admin/*'],
    },
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
