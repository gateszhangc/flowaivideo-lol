import { MetadataRoute } from 'next';

import { envConfigs } from '@/config';

const ROUTES: {
  path: string;
  priority: number;
  changeFrequency: 'daily' | 'weekly' | 'monthly';
}[] = [
  { path: '/', priority: 1, changeFrequency: 'daily' },
  { path: '/pricing', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/privacy-policy', priority: 0.2, changeFrequency: 'monthly' },
  { path: '/terms-of-service', priority: 0.2, changeFrequency: 'monthly' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (envConfigs.app_url || 'https://flowaivideo.lol').replace(/\/$/, '');
  const lastModified = new Date();

  return ROUTES.map((route) => ({
    url: route.path === '/' ? base : `${base}${route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
