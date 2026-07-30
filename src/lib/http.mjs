const DEFAULT_TIMEOUT = 20_000;

export async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout ?? DEFAULT_TIMEOUT);
  try {
    const response = await fetch(url, {
      headers: { 'user-agent': 'Job-Fit-Scout/0.1 (personal job search)' },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

